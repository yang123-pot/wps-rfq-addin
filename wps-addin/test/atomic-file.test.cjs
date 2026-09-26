const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {writeFileAtomic}=require('../dev/atomic-file.cjs');
test('atomic writes succeed even while another reader keeps opening the same file',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-atomic-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const target=path.join(dir,'state.json');
 await writeFileAtomic(target,JSON.stringify({revision:0}));
 let reading=true,failures=[];
 // 模拟侧栏在保存同时反复读取同一份数据：Windows上rename可能报EPERM，必须靠重试兜住。
 const reader=(async()=>{
  while(reading){
   try{await fs.readFile(target,'utf8');}catch(error){failures.push(error.code);}
   await new Promise(resolve=>setTimeout(resolve,5));
  }
 })();
 const writes=[];
 for(let index=1;index<=40;index++)writes.push(writeFileAtomic(target,JSON.stringify({revision:index})));
 const results=await Promise.allSettled(writes);
 reading=false;await reader;
 assert.deepEqual(results.filter(item=>item.status==='rejected').map(item=>item.reason.message),[],
  '并发读取期间不得出现保存失败');
 const final=JSON.parse(await fs.readFile(target,'utf8'));
 assert.equal(Number.isSafeInteger(final.revision)&&final.revision>=1,true,'落盘内容必须是一份完整且有效的版本');
 assert.deepEqual(failures,[],'读取方也不应因为保存而读到错误');
 assert.deepEqual((await fs.readdir(dir)).filter(name=>name.includes('tmp')),[],'不得留下临时文件');
 // 串行写入（真实用法：同一份数据排队保存）必须最后一次生效。
 for(let index=41;index<=45;index++)await writeFileAtomic(target,JSON.stringify({revision:index}));
 assert.equal(JSON.parse(await fs.readFile(target,'utf8')).revision,45,'串行保存后必须落到最后一次版本');
});
test('a write that fails verification keeps the previous version and removes the temporary file',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-atomic-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const target=path.join(dir,'state.json');
 await writeFileAtomic(target,'{"ok":true}');
 await assert.rejects(writeFileAtomic(target,'{"ok":false}',function(){throw Error('校验不通过');}),/校验不通过/);
 assert.equal(await fs.readFile(target,'utf8'),'{"ok":true}','失败必须保留上一版');
 assert.deepEqual((await fs.readdir(dir)).sort(),['state.json']);
});
