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
test('each confirming project adds a source instead of duplicating the same memory',()=>{
 const first=memory.learn(memory.create(),confirmed,{item:item,sourceProjectId:'p-alpha'});
 assert.equal(first.memories.length,1);
 assert.deepEqual(first.memories[0].sources,[{sourceProjectId:'p-alpha',sourceRowId:'row-1',decisionRevision:2}]);
 assert.equal(memory.learn(first,confirmed,{item:item,sourceProjectId:'p-alpha'}),first,'同一项目同一行重复确认不得新增依据');
 const second=memory.learn(first,{...confirmed,rowId:'row-9'},{item:item,sourceProjectId:'p-beta'});
 assert.equal(second.memories.length,1,'同一材料同一类别只保留一条记忆');
 assert.deepEqual(second.memories[0].sources.map(entry=>entry.sourceProjectId),['p-alpha','p-beta']);
 assert.equal(memory.summary(second).sourceCount,2);
 assert.equal(second.history[second.history.length-1].action,'learn-source');
});
test('releasing one confirmation keeps the others and only the last one revokes',()=>{
 let current=memory.learn(memory.create(),confirmed,{item:item,sourceProjectId:'p-alpha'});
 current=memory.learn(current,{...confirmed,rowId:'row-9'},{item:item,sourceProjectId:'p-beta'});
 const released=memory.releaseSource(current,{categoryId:'water-valve'},{item:item,sourceProjectId:'p-beta',rowId:'row-9'});
 assert.equal(released.memories.length,1);
 assert.equal(released.memories[0].state,'active');
 assert.deepEqual(released.memories[0].sources.map(entry=>entry.sourceProjectId),['p-alpha']);
 assert.equal(released.history[released.history.length-1].action,'release-source');
 assert.equal(memory.find(released,item).matchLevel,'exact','另有有效确认来源时不得失效');
 const gone=memory.releaseSource(released,{categoryId:'water-valve'},{item:item,sourceProjectId:'p-alpha',rowId:'row-1'});
 assert.equal(gone.memories[0].state,'revoked');
 assert.equal(gone.history[gone.history.length-1].action,'release-revoke');
 assert.equal(memory.find(gone,item).matchLevel,'none');
 assert.equal(memory.releaseSource(gone,{categoryId:'water-valve'},{item:item,sourceProjectId:'p-alpha',rowId:'row-1'}),gone,
  '撤销不存在的来源不产生新版本');
});
test('legacy memories without recorded sources are kept and never guessed away',()=>{
 const legacy={schemaVersion:1,version:'local-1',updatedAt:'2026-01-01T00:00:00.000Z',
  memories:[{id:'m-legacy',item:{name:'水龙头',feature:'DN15',unit:'个'},categoryId:'water-valve',categoryName:'水阀门',
   scope:'global',projectId:null,sourceRowId:'row-1',state:'active',learnedAt:'2026-01-01T00:00:00.000Z'}],history:[]};
 assert.equal(memory.validate(legacy).ok,true);
 assert.equal(memory.releaseSource(legacy,{categoryId:'water-valve'},{item:item,sourceProjectId:'p-alpha',rowId:'row-1'}),legacy,
  '旧历史记忆没有来源清单时保持原样');
 assert.equal(memory.find(legacy,item).matchLevel,'exact');
 assert.throws(()=>memory.releaseSource(memory.create(),{},{item:item}),/撤销习惯需要原类别/);
 assert.match(memory.validate({...memory.create(),memories:[{id:'m',categoryId:'c',item:{name:'x'},state:'active',sources:'bad'}]})
  .errors.join('；'),/确认来源无效/);
});
