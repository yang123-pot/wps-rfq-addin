const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const header=require('../src/inquiry-header.js'),{createHeaderStore,FILE_NAME}=require('../dev/header-store.cjs');
const filled={schemaVersion:1,company:'测试安装工程有限公司',address:'测试市测试路1号',phone:'010-12345678',
 projectName:'测试楼项目',contact:'测试员'};
test('the header requires every Q6 field and never invents real defaults',()=>{
 assert.deepEqual(header.validate(filled),{ok:true,errors:[]});
 assert.equal(header.validate(header.create()).ok,false);
 assert.match(header.validate(Object.assign({},filled,{company:''})).errors.join('；'),/缺少公司名称/);
 assert.match(header.validate(Object.assign({},filled,{phone:'   '})).errors.join('；'),/缺少联系方式/);
 assert.equal(header.validate(Object.assign({},filled,{contact:'分机8001'})).ok,true,'合法分机不得被手机号规则排除');
 assert.equal(header.validate(Object.assign({},filled,{phone:'010-12345678转8001'})).ok,true);
 assert.match(header.validate({...filled,schemaVersion:9}).errors.join('；'),/版本不支持/);
 assert.throws(()=>header.assertValid(header.create()),/询价抬头不完整/);
 assert.equal(header.create().company,'','默认值必须是空字符串，不得填真实公司信息');
});
test('header rows follow the local material-classification layout',()=>{
 const rows=header.rows(filled,'某供应商');
 assert.deepEqual(rows.map(row=>row[0]),['测试安装工程有限公司','公司地址：测试市测试路1号','电话：010-12345678',
  '供货单位：某供应商','工程名称：测试楼项目','材料员：测试员']);
 assert.deepEqual(header.rows(filled,'').map(row=>row[0])[3],'供货单位：');
 assert.match(header.summary(filled),/公司名称：测试安装工程有限公司/);
 assert.equal(header.same(filled,Object.assign({},filled,{address:'测试市测试路1号 '})),true,'首尾空格不算变化');
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
