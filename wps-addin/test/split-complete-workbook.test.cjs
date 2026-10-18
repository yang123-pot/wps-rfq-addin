const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const plan=require('../src/split-plan.js'),state=require('../src/split-state.js'),{createSplitStore}=require('../dev/split-store.cjs');
const xlsx=require('./fixtures/xlsx-container.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-complete-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const out=path.join(root,'out');await fs.mkdir(out);const source=path.join(root,'园区_询价总表.xlsx');
 const bytes=xlsx.workbook([{name:'水泵询价表',values:[['完整内容'],['001','20','通达 / 海岳']]},{name:'内部追溯',values:[['保留原样']]}]);await fs.writeFile(source,bytes);
 const model={inputKey:'ck2-complete-test',sheets:[{kind:'inquiry',sheetId:'sheet-pump',name:'水泵询价表',categoryName:'水泵',supplier:'供应商',values:[['标题'],['材料']],headerRow:1}]};
 const generation={inputKey:model.inputKey,target:source,sha256:sha(bytes),modelSnapshot:model};
 return {root,out,source,bytes,generation,service:createSplitStore({directory:path.join(root,'receipts')}),payload:{projectId:'p-complete-01',batchId:'b-complete-01',targetDirectory:out,currentKey:model.inputKey,generation}};
}
test('计划同时包含每张询价页和一份完整总表，完整文件不作为供应商询价页',async t=>{
 const fx=await fixture(t),built=plan.build({model:fx.generation.modelSnapshot,generation:fx.generation,targetDirectory:fx.out});
 assert.equal(built.files.length,2);const full=built.files.find(f=>f.kind==='complete-workbook');assert.ok(full);assert.equal(full.name,'园区_询价总表_完整文件.xlsx');
 assert.equal(full.target,path.join(fx.out,full.name));assert.equal(built.files.filter(f=>f.kind==='inquiry').length,1);
});
test('完整工作簿逐字节复制，重复导出不覆盖，显式核对不改文件',async t=>{
 const fx=await fixture(t);assert.equal(typeof fx.service.copyComplete,'function');await fx.service.prepare(fx.payload);
 const result=await fx.service.copyComplete(fx.payload);assert.deepEqual(await fs.readFile(result.target),fx.bytes);assert.equal(result.sha256,sha(fx.bytes));
 assert.deepEqual(await fs.readFile(fx.source),fx.bytes);await assert.rejects(fx.service.copyComplete(fx.payload),/已存在|覆盖/);
 const info=await fs.stat(result.target),verified=await fx.service.copyComplete({...fx.payload,verifyOnly:true});assert.equal(verified.sha256,result.sha256);assert.equal((await fs.stat(result.target)).mtimeMs,info.mtimeMs);
 await fs.writeFile(result.target,'外部改动');await assert.rejects(fx.service.copyComplete({...fx.payload,verifyOnly:true}),/不一致|变化/);assert.equal(await fs.readFile(result.target,'utf8'),'外部改动');
});
test('总表过期或未准备回执时拒绝复制，未写入任何完整文件',async t=>{
 const fx=await fixture(t);assert.equal(typeof fx.service.copyComplete,'function');await assert.rejects(fx.service.copyComplete(fx.payload),/准备|回执/);
 await fx.service.prepare(fx.payload);await fs.appendFile(fx.source,'changed');await assert.rejects(fx.service.copyComplete(fx.payload),/变化|修改|不一致/);assert.deepEqual(await fs.readdir(fx.out),[]);
});
test('写入中断不留下损坏的最终文件，可在原文件夹直接重试',async t=>{
 const fx=await fixture(t),prepared=await fx.service.prepare(fx.payload),full=prepared.plan.files.find(f=>f.kind==='complete-workbook');
 const write=fs.writeFile,open=fs.open;let fail=true;
 function failNow(){const e=Error('模拟磁盘写满');e.code='ENOSPC';return e;}
 fs.writeFile=async function(file,bytes,options){if(fail&&String(file)===full.target){fail=false;await write.call(this,file,bytes.subarray(0,100),options);throw failNow();}return write.apply(this,arguments);};
 fs.open=async function(file,flags){const h=await open.apply(this,arguments);if(String(file).includes('.rfq-complete-')){const put=h.writeFile.bind(h);h.writeFile=async function(bytes){if(fail){fail=false;await put(bytes.subarray(0,100));throw failNow();}return put(bytes);};}return h;};
 try{await assert.rejects(fx.service.copyComplete(fx.payload),/磁盘写满/);}finally{fs.writeFile=write;fs.open=open;}
 assert.deepEqual(await fs.readdir(fx.out),[],'失败清理本次暂存，不留最终损坏文件或临时文件');
 const result=await fx.service.copyComplete(fx.payload);assert.deepEqual(await fs.readFile(result.target),fx.bytes);
});
test('旧批次只补完整文件，保留已经成功的供应商记录；发布未记账不得自动成功',async t=>{
 const fx=await fixture(t),built=plan.build({model:fx.generation.modelSnapshot,generation:fx.generation,targetDirectory:fx.out});
 assert.equal(built.files.length,2);const legacyPlan={...built,files:built.files.filter(f=>f.kind!=='complete-workbook')};
 let legacy=state.create(legacyPlan,fx.generation.sha256,{projectId:fx.payload.projectId,batchId:fx.payload.batchId});
 await fs.writeFile(legacy.files[0].target,'supplier-success');legacy=state.mark(legacy,legacy.files[0].fileId,'succeeded',sha(Buffer.from('supplier-success')));await fx.service.save(legacy,{expectedRevision:0});
 const prepared=await fx.service.prepare(fx.payload);assert.equal(prepared.receipt.files.length,2);assert.equal(prepared.receipt.files[0].state,'succeeded');assert.equal(prepared.receipt.files[1].state,'pending');
 const result=await fx.service.copyComplete(fx.payload);const unrecorded=await fx.service.prepare(fx.payload);assert.equal(unrecorded.receipt.files[1].state,'needs-verification');assert.equal(unrecorded.summary.done,false);
 await fs.unlink(result.target);await assert.rejects(fx.service.copyComplete({...fx.payload,verifyOnly:true}),/不存在/);assert.equal((await fx.service.prepare(fx.payload)).receipt.files[0].state,'succeeded');
});
