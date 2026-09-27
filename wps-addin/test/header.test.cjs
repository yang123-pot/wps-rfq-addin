const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const header=require('../src/inquiry-header.js'),{createHeaderStore,FILE_NAME}=require('../dev/header-store.cjs');
const filled={schemaVersion:1,projectName:'示例园区',company:'示例建设公司',contact:'测试员',
 phone:'010-12345678',address:'示例市示例路1号'};
test('the header requires the four 图06 fields, keeps address optional and never invents real defaults',()=>{
 assert.deepEqual(header.validate(filled),{ok:true,errors:[]});
 assert.equal(header.validate(Object.assign({},filled,{address:''})).ok,true,'原公司地址可选，留空仍可生成');
 assert.equal(header.validate(header.create()).ok,false);
 assert.match(header.validate(Object.assign({},filled,{projectName:' '})).errors.join('；'),/缺少项目名称/);
 assert.match(header.validate(Object.assign({},filled,{company:''})).errors.join('；'),/缺少单位名称/);
 assert.match(header.validate(Object.assign({},filled,{contact:''})).errors.join('；'),/缺少材料经办人/);
 assert.match(header.validate(Object.assign({},filled,{phone:'   '})).errors.join('；'),/缺少联系方式/);
 assert.equal(header.validate(Object.assign({},filled,{phone:'010-12345678转8001'})).ok,true);
 assert.match(header.validate({...filled,schemaVersion:9}).errors.join('；'),/版本不支持/);
 assert.throws(()=>header.assertValid(header.create()),/询价抬头不完整/);
 assert.equal(header.create().company,'','默认值必须是空字符串，不得填真实公司信息');
 assert.deepEqual(header.REQUIRED,['projectName','company','contact','phone'],'四项必填，原公司地址不在必填内');
});
test('header block follows 图06 with a per-group supplier area',()=>{
 const block=header.block(Object.assign({},filled,{address:''}),
  [{brand:'通达',supplier:'正通商贸'},{brand:'海岳',supplier:'安合设备'}]);
 assert.deepEqual(block.lines.map(row=>row[0]),
  ['示例园区材料询价表','','项目名称：示例园区','材料经办人：测试员','供应商信息','']);
 assert.equal(block.lines[2][5],'单位名称：示例建设公司');
 assert.equal(block.lines[3][5],'联系方式：010-12345678');
 assert.equal(block.lines[4][1],'通达 — 正通商贸');
 assert.equal(block.lines[5][1],'海岳 — 安合设备');
 assert.equal(block.supplierFirstRow,5);
 assert.equal(block.supplierRowCount,2);
 assert.equal(block.headerRow,7,'两组供应商时表头在第7行（与图06一致）');
 const withAddress=header.block(filled,[{brand:'通达',supplier:'正通商贸'}]);
 assert.equal(withAddress.addressRow,5);
 assert.equal(withAddress.headerRow,7,'填写可选地址后表头行随之下移');
 assert.equal(withAddress.lines[4][0],'原公司地址：示例市示例路1号');
 assert.match(header.summary(filled),/项目名称：示例园区/);
 assert.match(header.summary(filled),/材料经办人：测试员/);
 assert.equal(header.same(filled,Object.assign({},filled,{address:'示例市示例路1号 '})),true,'首尾空格不算变化');
 assert.equal(header.same(filled,Object.assign({},filled,{address:'另一个地址'})),false);
});
test('header templates are stored in their own file with revision conflicts',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-header-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const store=createHeaderStore({directory:dir});
 const start=await store.load();
 assert.equal(start.revision,0);
 assert.deepEqual(start.templates,[]);
 assert.deepEqual(await fs.readdir(dir),[]);
 const saved=await store.save({expectedRevision:0,templates:[{templateId:'t-1',name:'常用抬头',header:filled}]});
 assert.equal(saved.revision,1);
 assert.equal(saved.path,path.join(dir,FILE_NAME));
 const reloaded=await store.load();
 assert.equal(reloaded.templates.length,1);
 assert.deepEqual(reloaded.templates[0].header,header.normalize(filled));
 await assert.rejects(store.save({expectedRevision:0,templates:[]}),/版本冲突/);
 await assert.rejects(store.save({expectedRevision:1,templates:[{name:'缺抬头',header:{}}]}),/抬头不完整/);
 assert.equal((await store.load()).revision,1,'失败不得改动上一版');
 await fs.writeFile(path.join(dir,FILE_NAME),'{"broken"');
 await assert.rejects(store.load(),/损坏/);
});
