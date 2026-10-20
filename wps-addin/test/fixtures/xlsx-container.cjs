// Small ZIP/XLSX fixture builder, independent of the production container reader.
const zlib=require('node:zlib');
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function zip(files){const local=[],central=[];let offset=0;for(const [name,value]of Object.entries(files)){
 const label=Buffer.from(name),data=Buffer.isBuffer(value)?value:Buffer.from(value),crc=crc32(data);
 const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt32LE(crc,14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(label.length,26);
 const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt32LE(crc,16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(label.length,28);c.writeUInt32LE(offset,42);
 local.push(h,label,data);central.push(c,label);offset+=h.length+label.length+data.length;
 }const dir=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,dir,end]);}
function entries(bytes){const result={};let e=bytes.length-22;while(e>=0&&bytes.readUInt32LE(e)!==0x06054b50)e--;if(e<0)throw Error('no ZIP directory');let p=bytes.readUInt32LE(e+16);for(let i=0;i<bytes.readUInt16LE(e+10);i++){
 const size=bytes.readUInt32LE(p+20),length=bytes.readUInt16LE(p+28),extra=bytes.readUInt16LE(p+30),comment=bytes.readUInt16LE(p+32),offset=bytes.readUInt32LE(p+42),name=bytes.subarray(p+46,p+46+length).toString();
 const start=offset+30+bytes.readUInt16LE(offset+26)+bytes.readUInt16LE(offset+28),data=bytes.subarray(start,start+size),method=bytes.readUInt16LE(p+10);result[name]=method===0?data:zlib.inflateRawSync(data);p+=46+length+extra+comment;
 }return result;}
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
function escape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
function workbook(sheets){const files={
 '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+sheets.map((s,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>',
 '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="'+rel+'/officeDocument" Target="xl/workbook.xml"/></Relationships>',
 'xl/workbook.xml':'<workbook xmlns="'+ns+'" xmlns:r="'+rel+'"><sheets>'+sheets.map((s,i)=>'<sheet name="'+escape(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>',
 'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((s,i)=>'<Relationship Id="rId'+(i+1)+'" Type="'+rel+'/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'</Relationships>',
 'sentinel.bin':Buffer.from([0,255,23,128])};
 sheets.forEach((s,i)=>{const rows=s.values||[[s.value||'000123\n长特征 & =1+1']];files['xl/worksheets/sheet'+(i+1)+'.xml']='<worksheet xmlns="'+ns+'"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" state="frozenSplit" topLeftCell="A2"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><sheetData>'+rows.map((row,r)=>'<row r="'+(r+1)+'">'+row.map((v,c)=>'<c r="'+String.fromCharCode(65+c)+(r+1)+'" t="inlineStr"><is><t>'+escape(v)+'</t></is></c>').join('')+'</row>').join('')+'</sheetData><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>';});return zip(files);}
module.exports={zip,entries,workbook};
