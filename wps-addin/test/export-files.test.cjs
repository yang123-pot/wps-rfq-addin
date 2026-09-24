const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createExportStore}=require('../dev/export-files.cjs');
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-export-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return {root,store:createExportStore({directory:path.join(root,'staging')}),target:path.join(root,'清单.xlsx')};}
const zip=Buffer.from([0x50,0x4b,0x03,0x04,1,2,3,4]);
test('prepares a new target, publishes exact bytes and supports idempotent result checks',async t=>{
 const {store,target}=await fixture(t),p=await store.prepare(target);assert.notEqual(p.stagePath,target);
 await fs.writeFile(p.stagePath,zip);const result=await store.commit(p.ticket);
 assert.deepEqual(await fs.readFile(target),zip);assert.equal(result.bytes,zip.length);assert.match(result.sha256,/^[a-f0-9]{64}$/);
 assert.deepEqual(await store.commit(p.ticket),result);
 await fs.writeFile(target,'user changed');await assert.rejects(store.commit(p.ticket),/变化/);
});
test('rejects existing target including a race after preparation and never overwrites it',async t=>{
 const {store,target}=await fixture(t),p=await store.prepare(target);await fs.writeFile(p.stagePath,zip);await fs.writeFile(target,'existing');
 await assert.rejects(store.commit(p.ticket),/存在/);assert.equal(await fs.readFile(target,'utf8'),'existing');
 await assert.rejects(store.prepare(target),/存在/);
});
test('invalid destinations, tickets and incomplete stage files cannot be published',async t=>{
 const {store,target,root}=await fixture(t);
 for(const name of ['relative.xlsx',path.join(root,'out.xls'),path.join(root,'no-directory','out.xlsx'),path.join(root,'bad:name.xlsx')])await assert.rejects(store.prepare(name));
 await assert.rejects(store.commit('unknown'),/会话/);const p=await store.prepare(target);
 await assert.rejects(store.commit(p.ticket),/暂存/);await fs.writeFile(p.stagePath,'not xlsx');await assert.rejects(store.commit(p.ticket),/xlsx/);
 assert.equal(await fs.stat(target).then(()=>true,()=>false),false);
});
