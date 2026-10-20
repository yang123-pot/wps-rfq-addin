const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {prepareFiles}=require('../dev/import-files.cjs');
async function setup(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-import-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return {root,directory:path.join(root,'copies')};}
test('copies exact bytes under a unique path with canonical origin and SHA256 before host access',async t=>{
 const {root,directory}=await setup(t), file=path.join(root,'清单.xlsx'), bytes=Buffer.from('workbook bytes');await fs.writeFile(file,bytes);
 const [m]=await prepareFiles([path.join(root,'sub','..','清单.xlsx')],{directory});
 assert.equal(m.originalPath,await fs.realpath(file));assert.equal(m.originalName,'清单.xlsx');
 assert.equal(m.fingerprint,crypto.createHash('sha256').update(bytes).digest('hex'));assert.notEqual(m.copyPath,m.originalPath);
 assert.notEqual(path.basename(m.copyPath),m.originalName,'WPS cannot open two workbooks with the same filename');
 assert.deepEqual(await fs.readFile(m.copyPath),bytes);await fs.writeFile(m.copyPath,'host metadata edit');assert.deepEqual(await fs.readFile(file),bytes);
 const again=await prepareFiles([file],{directory});assert.notEqual(again[0].copyPath,m.copyPath);assert.notEqual(path.basename(again[0].copyPath),path.basename(m.copyPath));
 assert.equal(JSON.parse(await fs.readFile(path.join(path.dirname(path.dirname(m.copyPath)),'manifest.json'),'utf8')).files[0].originalPath,m.originalPath);
});
test('rejects path duplicates, same bytes under a different name, and already imported files',async t=>{
 const {root,directory}=await setup(t),a=path.join(root,'a.xls'),b=path.join(root,'b.xls');await fs.writeFile(a,'same');await fs.writeFile(b,'same');
 await assert.rejects(prepareFiles([a,a],{directory}),/重复/);await assert.rejects(prepareFiles([a,b],{directory}),/重复/);
 const existing=await prepareFiles([a],{directory});await assert.rejects(prepareFiles([b],{directory,existing}),/重复/);
 await fs.writeFile(a,'changed');await assert.rejects(prepareFiles([a],{directory,existing}),/重复/);
 await assert.rejects(prepareFiles([existing[0].copyPath],{directory}),/工作副本/);
});
test('same filename in different directories with different bytes remains separate',async t=>{
 const {root,directory}=await setup(t);await fs.mkdir(path.join(root,'a'));await fs.mkdir(path.join(root,'b'));
 const files=['a','b'].map(d=>path.join(root,d,'清单.xls'));await fs.writeFile(files[0],'one');await fs.writeFile(files[1],'two');
 const copies=await prepareFiles(files,{directory});assert.equal(copies.length,2);assert.notEqual(copies[0].copyPath,copies[1].copyPath);
 assert.notEqual(path.basename(copies[0].copyPath),path.basename(copies[1].copyPath));
});
test('invalid batch does not create partial copies and enforces count, extension and byte limits',async t=>{
 const {root,directory}=await setup(t),file=path.join(root,'a.xlsx');await fs.writeFile(file,'abcd');
 await assert.rejects(prepareFiles([file,path.join(root,'missing.xlsx')],{directory}),/读取|不存在/);
 await assert.rejects(prepareFiles([file],{directory,maxFileBytes:3}),/大小/);
 await assert.rejects(prepareFiles([file],{directory,maxBatchBytes:3}),/大小/);
 await assert.rejects(prepareFiles(Array(21).fill(file),{directory}),/20/);
 await assert.rejects(prepareFiles(['relative.xlsx'],{directory}),/绝对/);
 await assert.rejects(prepareFiles([path.join(root,'private.txt')],{directory}),/xls/);
 assert.deepEqual(await fs.readdir(directory).catch(e=>e.code==='ENOENT'?[]:Promise.reject(e)),[]);
});
