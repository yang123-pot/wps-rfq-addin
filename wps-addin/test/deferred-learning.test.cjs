const test=require('node:test'),assert=require('node:assert/strict'),learning=require('../src/deferred-learning.js'),ops=require('../src/library-operations.js'),mem=require('../src/category-memory.js');
test('learning waits for verified split, decisions bind confirmation version, skip never alters outputs',()=>{
 const review={inputKey:'k1',revision:2,confirmedAt:'now',rows:[{rowId:'r',categoryId:'a',name:'阀',feature:'DN50',unit:'个'}]},split={inputKey:'s',files:[{state:'succeeded',sha256:'a'.repeat(64),verifiedBy:'publish'}]};
 assert.equal(learning.pending(review,null,null),false);assert.equal(learning.pending(review,split,null),true);
 const decision=learning.decide(review,'skipped');assert.equal(learning.pending(review,split,decision),false);assert.equal(split.files[0].state,'succeeded');
 assert.equal(learning.pending({...review,revision:3},split,decision),true);assert.equal(learning.pending(review,{files:[{state:'failed'}]},null),false);
});
test('batch learns all confirmed rows, deduplicates signatures and retries idempotently without replacing full history',()=>{
 const s={library:{version:'x',categories:[{id:'a',name:'阀门'}],rules:[]},memory:mem.create()},review={inputKey:'k',revision:1,confirmedAt:'now',rows:[1,2].map(n=>({rowId:'r'+n,name:'阀',feature:'DN50',unit:'个',categoryId:'a',categoryName:'阀门'}))};
 const n=ops.learnSnapshot(s,review,'project-1');assert.equal(n.memory.memories.length,1);assert.equal(n.memory.memories[0].sources.length,2);
 assert.deepEqual(ops.learnSnapshot(n,review,'project-1'),n);assert.equal(s.memory.memories.length,0);
 const skipped=ops.skipSnapshot(n,review,'project-1');assert.equal(skipped.memory.memories.filter(m=>m.state==='active').length,0);assert.equal(skipped.memory.learnedConfirmations.length,0);assert.equal(n.memory.memories[0].state,'active');
});
