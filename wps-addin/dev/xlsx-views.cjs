'use strict';
// Narrow OPC/ZIP32 editor for our newly saved XLSX stages. Never extracts files.
// ZIP record layout: https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
const zlib=require('node:zlib');
const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main',REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function archive(bytes){
 function need(ok){if(!ok)throw Error('不支持或损坏的XLSX ZIP容器。');}
 need(bytes.length>=22);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50&&i+22+bytes.readUInt16LE(i+20)===bytes.length){end=i;break;}
 need(end>=0);const count=bytes.readUInt16LE(end+10),start=bytes.readUInt32LE(end+16),size=bytes.readUInt32LE(end+12);
 need(!bytes.readUInt16LE(end+4)&&!bytes.readUInt16LE(end+6)&&count===bytes.readUInt16LE(end+8)&&count>0&&count<10000&&start+size===end);
 const entries=[],names=new Set();let p=start;
 for(let i=0;i<count;i++){
  need(p+46<=end&&bytes.readUInt32LE(p)===0x02014b50);
  const flags=bytes.readUInt16LE(p+8),method=bytes.readUInt16LE(p+10),compressed=bytes.readUInt32LE(p+20),length=bytes.readUInt32LE(p+24),
   label=bytes.readUInt16LE(p+28),extra=bytes.readUInt16LE(p+30),comment=bytes.readUInt16LE(p+32),offset=bytes.readUInt32LE(p+42),next=p+46+label+extra+comment;
  need(next<=end&&!(flags&0x41)&&[0,8].includes(method)&&compressed!==0xffffffff&&length!==0xffffffff&&!bytes.readUInt16LE(p+34)&&offset+30<start);
  const rawName=bytes.subarray(p+46,p+46+label),name=rawName.toString('utf8');need(Buffer.from(name).equals(rawName)&&!names.has(name));names.add(name);
  need(bytes.readUInt32LE(offset)===0x04034b50&&bytes.readUInt16LE(offset+6)===flags&&bytes.readUInt16LE(offset+8)===method);
  const dataStart=offset+30+bytes.readUInt16LE(offset+26)+bytes.readUInt16LE(offset+28);need(dataStart+compressed<=start);
  need(bytes.subarray(offset+30,offset+30+bytes.readUInt16LE(offset+26)).equals(rawName));
  entries.push({name,flags,method,compressed,length,offset,dataStart,crc:bytes.readUInt32LE(p+16),central:Buffer.from(bytes.subarray(p,next))});p=next;
 }
 need(p===end);const ordered=entries.slice().sort((a,b)=>a.offset-b.offset);need(ordered[0].offset===0);
 ordered.forEach((e,i)=>{e.localEnd=i+1<ordered.length?ordered[i+1].offset:start;need(e.dataStart+e.compressed<=e.localEnd);});
 function read(name,limit){const e=entries.find(e=>e.name===name);need(!!e&&e.length<=limit);const data=bytes.subarray(e.dataStart,e.dataStart+e.compressed),raw=e.method===0?data:zlib.inflateRawSync(data,{maxOutputLength:limit});need(raw.length===e.length&&crc32(raw)===e.crc);return raw;}
 function replace(changes){let offset=0;const locals=[];
  for(const e of ordered){e.newOffset=offset;let local;
   if(changes.has(e.name)){
    const raw=Buffer.from(changes.get(e.name)),data=e.method===0?raw:zlib.deflateRawSync(raw),header=Buffer.from(bytes.subarray(e.offset,e.dataStart)),crc=crc32(raw),flags=e.flags&~8;
    header.writeUInt16LE(flags,6);header.writeUInt32LE(crc,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(raw.length,22);
    e.central.writeUInt16LE(flags,8);e.central.writeUInt32LE(crc,16);e.central.writeUInt32LE(data.length,20);e.central.writeUInt32LE(raw.length,24);local=Buffer.concat([header,data]);
   }else local=bytes.subarray(e.offset,e.localEnd);
   locals.push(local);offset+=local.length;
  }
  const central=Buffer.concat(entries.map(e=>{e.central.writeUInt32LE(e.newOffset,42);return e.central;})),ending=Buffer.from(bytes.subarray(end));
  ending.writeUInt32LE(central.length,12);ending.writeUInt32LE(offset,16);return Buffer.concat([...locals,central,ending]);
 }
 return {read,replace,has:name=>names.has(name)};
}
function decode(value){
 const decoded=value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,e)=>{if(e[0]==='#'){const n=e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):Number(e.slice(1));if(!n||n>0x10ffff)throw Error('XML属性字符无效。');return String.fromCodePoint(n);}return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[e];});
 if(/&(?!(?:#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);)/i.test(value))throw Error('XML属性转义无效。');return decoded;
}
function xmlTree(text){
 if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('XLSX XML不允许DTD或外部实体。');
 const stack=[],roots=[];let p=0;
 while((p=text.indexOf('<',p))>=0){
  if(text.startsWith('<!--',p)){const q=text.indexOf('-->',p+4);if(q<0)throw Error('XML注释损坏。');p=q+3;continue;}
  if(text.startsWith('<?',p)){const q=text.indexOf('?>',p+2);if(q<0)throw Error('XML声明损坏。');p=q+2;continue;}
  if(text.startsWith('<![CDATA[',p)){const q=text.indexOf(']]>',p+9);if(q<0)throw Error('XML文本损坏。');p=q+3;continue;}
  let q=p+1,quote=null;for(;q<text.length;q++){const c=text[q];if(quote){if(c===quote)quote=null;}else if(c==='"'||c==="'")quote=c;else if(c==='>')break;}
  if(q===text.length)throw Error('XML元素损坏。');const tag=text.slice(p+1,q);
  if(tag[0]==='/'){const node=stack.pop();if(!node||tag.slice(1).trim()!==node.name)throw Error('XML元素不匹配。');node.closeStart=p;node.end=q+1;}
  else{
   const match=/^([A-Za-z_][\w.:-]*)/.exec(tag);if(!match)throw Error('XML元素名无效。');
   const attrs=Object.create(null);let rest=tag.slice(match[0].length).replace(/\/\s*$/,'');
   while(rest.trim()){
    const a=/^\s+([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(rest);if(!a||Object.hasOwn(attrs,a[1]))throw Error('XML属性无效。');attrs[a[1]]=decode(a[2]===undefined?a[3]:a[2]);rest=rest.slice(a[0].length);
   }
   const parent=stack[stack.length-1]||null,node={name:match[0],local:match[0].split(':').pop(),attrs,children:[],parent,start:p,openEnd:q+1};
   (parent?parent.children:roots).push(node);if(/\/\s*$/.test(tag)){node.end=q+1;node.closeStart=q+1;}else stack.push(node);
  }p=q+1;
 }
 if(stack.length||roots.length!==1)throw Error('XML根元素无效。');return roots[0];
}
function namespace(node){const prefix=node.name.includes(':')?node.name.split(':')[0]:'';for(let n=node;n;n=n.parent){const key=prefix?'xmlns:'+prefix:'xmlns';if(Object.hasOwn(n.attrs,key))return n.attrs[key];}return null;}
function escape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
function columnName(n){let s='';for(;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
function patchViews(text,freeze){
 const root=xmlTree(text);if(root.local!=='worksheet'||namespace(root)!==NS)throw Error('工作表XML命名空间无效。');
 const views=root.children.filter(n=>n.local==='sheetViews'&&namespace(n)===NS);if(views.length>1)throw Error('工作表视图重复。');
 const row=freeze.row-1,col=freeze.column-1,cell=columnName(col+1)+(row+1),active=row&&col?'bottomRight':row?'bottomLeft':'topRight';
 function body(prefix){return '<'+prefix+'pane'+(col?' xSplit="'+col+'"':'')+(row?' ySplit="'+row+'"':'')+' topLeftCell="'+cell+'" activePane="'+active+'" state="frozen"/><'+prefix+'selection pane="'+active+'" activeCell="'+cell+'" sqref="'+cell+'"/>';}
 if(!views.length){const prefix=root.name.includes(':')?root.name.split(':')[0]+':':'',before=root.children.find(n=>!['sheetPr','dimension'].includes(n.local)),at=before?before.start:root.closeStart;
  return text.slice(0,at)+'<'+prefix+'sheetViews><'+prefix+'sheetView workbookViewId="0">'+body(prefix)+'</'+prefix+'sheetView></'+prefix+'sheetViews>'+text.slice(at);}
 const nodes=views[0].children.filter(n=>n.local==='sheetView'&&namespace(n)===NS);if(!nodes.length)throw Error('工作表缺少sheetView。');
 for(const view of nodes.reverse()){
  const prefix=view.name.includes(':')?view.name.split(':')[0]+':':'',attrs=Object.entries(view.attrs).filter(([k])=>k!=='topLeftCell').map(([k,v])=>' '+k+'="'+escape(v)+'"').join('');
  let inside=view.closeStart===view.openEnd?'':text.slice(view.openEnd,view.closeStart);
  for(const child of view.children.filter(n=>['pane','selection'].includes(n.local)&&namespace(n)===NS).reverse())inside=inside.slice(0,child.start-view.openEnd)+inside.slice(child.end-view.openEnd);
  const replacement='<'+view.name+attrs+'>'+body(prefix)+inside+'</'+view.name+'>';text=text.slice(0,view.start)+replacement+text.slice(view.end);
 }return text;
}
function patchWorkbook(bytes,plan){
 const zip=archive(bytes),workbook=xmlTree(zip.read('xl/workbook.xml',1024*1024).toString('utf8')),relations=xmlTree(zip.read('xl/_rels/workbook.xml.rels',1024*1024).toString('utf8'));
 if(workbook.local!=='workbook'||namespace(workbook)!==NS)throw Error('工作簿XML无效。');
 const sheets=workbook.children.find(n=>n.local==='sheets'&&namespace(n)===NS),items=sheets?sheets.children.filter(n=>n.local==='sheet'):[];
 if(items.length!==plan.length)throw Error('工作表数量与冻结计划不一致。');const changes=new Map(),paths=new Set();
 for(let i=0;i<items.length;i++){
  const sheet=items[i],spec=plan[i];if(sheet.attrs.name!==spec.name)throw Error('工作表名称或顺序与冻结计划不一致。');
  const ridKey=Object.keys(sheet.attrs).find(k=>k.includes(':')&&k.split(':').pop()==='id'),rid=sheet.attrs[ridKey];
  const matches=relations.children.filter(r=>r.local==='Relationship'&&r.attrs.Id===rid);
  if(matches.length!==1||matches[0].attrs.TargetMode==='External'||matches[0].attrs.Type!==REL+'/worksheet')throw Error('工作表关系无效。');
  const uri=new URL(matches[0].attrs.Target,'https://xlsx.invalid/xl/workbook.xml'),part=decodeURIComponent(uri.pathname.slice(1));
  if(uri.origin!=='https://xlsx.invalid'||uri.search||uri.hash||!part.startsWith('xl/worksheets/')||paths.has(part)||!zip.has(part))throw Error('工作表关系路径无效。');paths.add(part);
  if(spec.freeze)changes.set(part,patchViews(zip.read(part,32*1024*1024).toString('utf8'),spec.freeze));
 }
 const result=zip.replace(changes);if(result.length>256*1024*1024)throw Error('冻结输出超过文件限制。');
 const reopened=archive(result);for(const [part,text]of changes)if(reopened.read(part,32*1024*1024).toString('utf8')!==text)throw Error('冻结XML保存读回不一致。');
 return {bytes:result,sheets:changes.size};
}
function readStructure(bytes){
 const zip=archive(bytes),workbook=xmlTree(zip.read('xl/workbook.xml',1024*1024).toString('utf8')),
  relations=xmlTree(zip.read('xl/_rels/workbook.xml.rels',1024*1024).toString('utf8'));
 if(workbook.local!=='workbook'||namespace(workbook)!==NS)throw Error('工作簿XML无效。');
 const sheets=workbook.children.find(n=>n.local==='sheets'&&namespace(n)===NS);
 const items=sheets?sheets.children.filter(n=>n.local==='sheet'):[];
 if(!items.length||items.length>1000)throw Error('工作表数量不符合限制。');
 const paths=new Set(),result=[];
 for(let index=0;index<items.length;index++){
  const sheet=items[index],name=String(sheet.attrs.name||'');
  if(!name)throw Error('工作表名称为空。');
  const ridKey=Object.keys(sheet.attrs).find(key=>key.includes(':')&&key.split(':').pop()==='id'),rid=sheet.attrs[ridKey];
  const matches=relations.children.filter(node=>node.local==='Relationship'&&node.attrs.Id===rid);
  if(matches.length!==1||matches[0].attrs.TargetMode==='External'||matches[0].attrs.Type!==REL+'/worksheet')
   throw Error('工作表关系无效：'+name);
  const uri=new URL(matches[0].attrs.Target,'https://xlsx.invalid/xl/workbook.xml'),part=decodeURIComponent(uri.pathname.slice(1));
  if(uri.origin!=='https://xlsx.invalid'||uri.search||uri.hash||!part.startsWith('xl/worksheets/')||paths.has(part)||!zip.has(part))
   throw Error('工作表关系路径无效：'+name);
  paths.add(part);
  const tree=xmlTree(zip.read(part,32*1024*1024).toString('utf8'));
  if(tree.local!=='worksheet'||namespace(tree)!==NS)throw Error('工作表XML无效：'+name);
  const dimension=tree.children.find(node=>node.local==='dimension'&&namespace(node)===NS);
  let rowCount=0,ref=String((dimension&&dimension.attrs&&dimension.attrs.ref)||''),match;
  if(ref&&(match=/:(?:[A-Z]+)(\d+)$/i.exec(ref)||/^[A-Z]+(\d+)$/i.exec(ref)))rowCount=Number(match[1])||0;
  if(!rowCount){
   const stack=[tree];
   while(stack.length){
    const node=stack.pop();
    if(node.local==='row'&&namespace(node)===NS)rowCount=Math.max(rowCount,Number(node.attrs.r)||0);
    for(const child of node.children)stack.push(child);
   }
  }
  result.push({index:index+1,sheetName:name,rowCount:rowCount});
 }
 return result;
}
module.exports={patchWorkbook,readStructure};
