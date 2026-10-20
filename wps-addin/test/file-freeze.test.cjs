const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createExportStore}=require('../dev/export-files.cjs'),fixture=require('./fixtures/xlsx-container.cjs');
const {patchWorkbook}=require('../dev/xlsx-views.cjs');
const sheets=[{name:'风口、风阀',freeze:{row:7,column:1}},{name:'双向冻结',freeze:{row:4,column:3}},{name:'来源明细',freeze:null}];
async function setup(t,plan=sheets){const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-file-freeze-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const store=createExportStore({directory:path.join(root,'stages')});const p=await store.prepare(path.join(root,'询价.xlsx'),{freezePlan:plan});await fs.writeFile(p.stagePath,fixture.workbook(sheets));return {root,store,p};}
test('new inquiry stages cannot publish before file freeze; only sheet views change',async t=>{
 const {store,p}=await setup(t),before=fixture.entries(await fs.readFile(p.stagePath));
 await assert.rejects(store.commit(p.ticket),/冻结/);
 assert.equal(typeof store.freeze,'function','ticket-bound file freeze must be available');
 const result=await store.freeze(p.ticket);assert.equal(result.sheets,2);assert.match(result.sha256,/^[a-f0-9]{64}$/);
 const after=fixture.entries(await fs.readFile(p.stagePath));assert.deepEqual(Object.keys(after).sort(),Object.keys(before).sort());
 for(const name of Object.keys(before)){
  if(/sheet[12]\.xml$/.test(name)){const strip=b=>b.toString().replace(/<sheetViews\b[\s\S]*?<\/sheetViews>/,'');assert.equal(strip(after[name]),strip(before[name]),name+' outside views unchanged');}
  else assert.deepEqual(after[name],before[name],name+' unchanged');
 }
 assert.match(after['xl/worksheets/sheet1.xml'].toString(),/ySplit="6"/);assert.match(after['xl/worksheets/sheet1.xml'].toString(),/topLeftCell="A7"/);
 assert.match(after['xl/worksheets/sheet2.xml'].toString(),/xSplit="2"/);assert.match(after['xl/worksheets/sheet2.xml'].toString(),/topLeftCell="C4"/);
 assert.deepEqual(await store.freeze(p.ticket),result,'repeated request is idempotent');
 const receipt=await store.commit(p.ticket);assert.equal(receipt.sha256,result.sha256);await assert.rejects(store.freeze(p.ticket),/发布/);
});
test('file freeze rejects unknown tickets, altered stages, invalid names and corrupted ZIP without publishing',async t=>{
 const {root,store,p}=await setup(t);assert.equal(typeof store.freeze,'function');
 await assert.rejects(store.freeze('unknown'),/会话/);
 await store.freeze(p.ticket);await fs.appendFile(p.stagePath,'changed');await assert.rejects(store.commit(p.ticket),/变化/);
 await assert.rejects(store.freeze(p.ticket),/变化/);assert.equal(await fs.stat(p.target).then(()=>true,()=>false),false);
 for(const plan of [[{name:'x',freeze:{row:0,column:1}}],[{name:'x',freeze:{row:7,column:1}},{name:'x',freeze:null}]])await assert.rejects(store.prepare(path.join(root,'invalid.xlsx'),{freezePlan:plan}),/冻结/);
 const corrupt=await store.prepare(path.join(root,'corrupt.xlsx'),{freezePlan:sheets});const bytes=Buffer.from('PK\x03\x04bad');await fs.writeFile(corrupt.stagePath,bytes);
 await assert.rejects(store.freeze(corrupt.ticket));assert.deepEqual(await fs.readFile(corrupt.stagePath),bytes);await assert.rejects(store.commit(corrupt.ticket),/冻结/);
});
test('sheet mapping mismatch is refused without changing the stage',async t=>{
 const {store,p}=await setup(t,[{name:'missing',freeze:{row:7,column:1}}]);assert.equal(typeof store.freeze,'function');
 const before=await fs.readFile(p.stagePath);await assert.rejects(store.freeze(p.ticket),/sheet|工作表/);assert.deepEqual(await fs.readFile(p.stagePath),before);
});
test('file metadata handles namespaced or absent views and refuses entity-bearing XML and bad CRC',()=>{
 const base=fixture.entries(fixture.workbook(sheets)),part='xl/worksheets/sheet1.xml';
 for(const arm of ['absent','prefix']){
  const files={...base};let xml=files[part].toString();
  if(arm==='absent')xml=xml.replace(/<sheetViews\b[\s\S]*?<\/sheetViews>/,'');
  else xml=xml.replace('<worksheet xmlns=', '<s:worksheet xmlns:s=').replace(/<(\/?)(worksheet|sheetViews|sheetView|pane|selection|sheetData|row|c|is|t|pageMargins)(?=[\s/>])/g,'<$1s:$2');
  // Root prefix is applied by the second replacement too; normalize that single root.
  xml=xml.replace('<s:s:worksheet','<s:worksheet');files[part]=xml;
  const output=fixture.entries(patchWorkbook(fixture.zip(files),sheets).bytes)[part].toString();assert.match(output,/ySplit="6"/);assert.match(output,/state="frozen"/);
 }
 const entity={...base,'xl/workbook.xml':Buffer.from('<!DOCTYPE workbook [<!ENTITY x SYSTEM "file:///private">]>'+base['xl/workbook.xml'])};
 assert.throws(()=>patchWorkbook(fixture.zip(entity),sheets),/DTD/);
 const broken=Buffer.from(fixture.workbook(sheets));broken[broken.indexOf(Buffer.from('<workbook'))+2]^=1;
 assert.throws(()=>patchWorkbook(broken,sheets),/损坏|容器/);
});
