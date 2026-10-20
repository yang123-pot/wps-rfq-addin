const test=require('node:test'),assert=require('node:assert/strict'),mem=require('../src/category-memory.js');
test('compact memory lookup builds once, ignores different-feature suggestions when exact exists, and preserves conflicts',()=>{
 const s={...mem.create(),compact:true,memories:[{id:'a',item:{name:'阀',feature:'DN50',unit:'个'},categoryId:'a',categoryName:'A',state:'active',scope:'global'},{id:'b',item:{name:'阀',feature:'DN65',unit:'个'},categoryId:'b',categoryName:'B',state:'active',scope:'global'}]};
 assert.deepEqual(mem.find(s,{name:'阀',feature:'DN50',unit:'个'}).candidates.map(x=>x.categoryId),['a']);
 assert.equal(mem.find(s,{name:'阀',feature:'其他',unit:'个'}).conflicts.length,2);
 let reads=0;const original=s.memories;s.memories=new Proxy(original,{get(t,p){if(p==='forEach')reads++;return Reflect.get(t,p);}});
 for(let i=0;i<100;i++)mem.find(s,{name:'阀',feature:'DN50',unit:'个'});
 assert.ok(reads<3,'must not scan whole memory per row');
});
