const test=require('node:test'),assert=require('node:assert/strict');
const memory=require('../src/category-memory.js');
const confirmed={rowId:'row-1',categoryId:'water-valve',categoryName:'水阀门',matchLevel:'exact',confirmedAt:'2026-09-24T00:00:00.000Z',revision:2,libraryVersion:'2026-09-24.1'};
const item={name:'水龙头',feature:'DN15',unit:'个'};
test('only confirmed decisions can be learned, and repeated confirmation does not duplicate',()=>{
 assert.throws(()=>memory.learn(memory.create(),{categoryId:'water-valve'},{}),/只有人工确认/);
 assert.throws(()=>memory.learn(memory.create(),{confirmedAt:'2026-09-24T00:00:00.000Z'},{}),/只有人工确认/);
 const first=memory.learn(memory.create(),confirmed,{item:item,projectId:'p-1'});
 assert.equal(first.memories.length,1);
 const record=first.memories[0];
 assert.equal(record.categoryId,'water-valve');assert.equal(record.scope,'global');assert.equal(record.state,'active');
 assert.equal(record.libraryVersion,'2026-09-24.1');assert.equal(record.decisionRevision,2);assert.equal(record.sourceRowId,'row-1');
 assert.equal(memory.learn(first,confirmed,{item:item,projectId:'p-1'}),first,'相同确认不重复写入');
 assert.equal(memory.summary(first).active,1);
});
test('finds exact and similar memories and never picks between conflicting ones',()=>{
 let current=memory.learn(memory.create(),confirmed,{item:item});
 const exact=memory.find(current,{name:'水龙头',feature:'DN15',unit:'个'});
 assert.equal(exact.matchLevel,'exact');assert.equal(exact.candidates[0].categoryName,'水阀门');
 assert.equal(exact.requiresConfirmation,true);assert.match(exact.candidates[0].basis,/记忆/);
 const similar=memory.find(current,{name:'水龙头',feature:'DN20 加长',unit:'个'});
 assert.equal(similar.matchLevel,'similar');
 assert.equal(memory.find(current,{name:'水表',feature:'',unit:'个'}).matchLevel,'none');
 const other=memory.learn(current,{...confirmed,categoryId:'no-inquiry',categoryName:'无需询价'},{item:item});
 const conflict=memory.find(other,{name:'水龙头',feature:'',unit:'个'});
 assert.equal(conflict.conflicts.length,2);assert.equal(conflict.matchLevel,'similar');
});
test('project exceptions stay inside their project and revoked memories stop matching',()=>{
 const base=memory.learn(memory.create(),confirmed,{item:item,scope:'project',projectId:'p-1'});
 assert.equal(memory.find(base,item,{projectId:'p-1'}).matchLevel,'exact');
 assert.equal(memory.find(base,item,{projectId:'p-2'}).matchLevel,'none','项目例外不得污染其他项目');
 assert.throws(()=>memory.learn(memory.create(),confirmed,{item:item,scope:'project'}),/项目标识/);
 const revoked=memory.revoke(base,base.memories[0].id);
 assert.equal(memory.find(revoked,item,{projectId:'p-1'}).matchLevel,'none');
 assert.equal(memory.summary(revoked).revoked,1);
 assert.equal(revoked.history[revoked.history.length-1].action,'revoke');
 assert.equal(memory.revoke(revoked,'missing'),revoked,'撤销不存在的记忆不产生新版本');
});
test('validation rejects unsupported or damaged memory files',()=>{
 assert.match(memory.validate({...memory.create(),schemaVersion:9}).errors.join('；'),/版本/);
 assert.match(memory.validate({...memory.create(),memories:[{id:'m',categoryId:'c',item:{},state:'paused'}]}).errors.join('；'),/状态无效/);
 assert.match(memory.validate({...memory.create(),memories:[{id:'m',categoryId:'c',state:'active'}]}).errors.join('；'),/材料字段/);
 assert.throws(()=>memory.learn({schemaVersion:1,version:'x',memories:[]},confirmed,{item:item}),/习惯记忆不完整/);
 assert.match(memory.validate({...memory.create(),history:null}).errors.join('；'),/变更历史/);
});
