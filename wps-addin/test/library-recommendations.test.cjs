const test=require('node:test'),assert=require('node:assert/strict');
const rec=require('../dev/library-recommendations.cjs'),memory=require('../src/category-memory.js');
function fixture(){return {revision:1,library:{version:'x',categories:[{id:'a',name:'阀门'},{id:'b',name:'水阀门'},{id:'c',name:'线缆'},{id:'d',name:'电线电缆'},{id:'z',name:'无需询价'},{id:'no-inquiry',name:'无需询价固定'}],rules:[]},memory:memory.create()};}
function record(id,categoryId,name='阀',feature='DN50'){return {id,categoryId,item:{name,feature,unit:'个'},state:'active',scope:'global',projectId:null,sources:[{sourceProjectId:'p',sourceRowId:id}]};}
test('name examples yield unordered manual candidates while fixed and inactive categories are excluded',()=>{
 const s=fixture();s.library.categories.find(c=>c.id==='z').state='disabled';s.library.categories.push({id:'archived',name:'水阀门旧',state:'archived'});const before=JSON.stringify(s),items=rec.scan(s);
 assert.ok(items.some(r=>r.categories.map(c=>c.name).join('/')==='阀门/水阀门'));assert.ok(items.some(r=>r.categories.map(c=>c.name).join('/')==='线缆/电线电缆'));
 assert.equal(new Set(items.map(r=>r.id)).size,items.length);assert.ok(items.every(r=>r.categories.every(c=>!['no-inquiry','archived','z'].includes(c.id))));
 assert.equal(items.find(r=>r.id===JSON.stringify(['a','b'])).strength,'name-only');assert.equal(JSON.stringify(s),before);
});
test('shared material evidence ranks first and returns only bounded representative fields',()=>{
 const s=fixture();s.library.categories.push({id:'e',name:'设备'},{id:'f',name:'机械'});s.memory.memories=[record('m1','e'),record('m2','f'),record('long','e','长材料','x'.repeat(20000))];s.memory.history=[{secret:'not for page'}];
 const items=rec.scan(s),first=items[0];assert.deepEqual(first.categories.map(c=>c.id),['e','f']);assert.equal(first.strength,'strong');assert.ok(first.reasons.some(r=>r.includes('相同材料')));
 assert.equal(first.categories[0].memories,2);assert.equal(first.categories[0].examples.length,2);assert.ok(first.categories[0].examples[1].feature.length<=160);assert.equal(first.categories[0].examples[0].sources,undefined);
 const page=rec.page(s,{pageSize:1000},items);assert.equal(page.pageSize,50);assert.equal(page.history,undefined);assert.equal(page.items[0].categories[0].examples[0].sourceProjectId,undefined);
 assert.throws(()=>rec.page(s,{page:0},items),/页码/);
});
test('keeping independent survives unrelated changes and new provenance, but material changes reopen the pair',()=>{
 const s=fixture();s.memory.memories=[record('m1','a'),record('m2','b')];let items=rec.scan(s),pair=items.find(r=>r.id===JSON.stringify(['a','b']));
 const next=rec.dismiss(s,{categoryIds:['b','a'],evidenceKey:pair.evidenceKey},items);assert.ok(!rec.scan(next).some(r=>r.id===pair.id));assert.equal(s.library.mergeDismissals,undefined);assert.equal(next.memory.memories[0].state,'active');
 next.library.categories.find(c=>c.id==='c').name='其他线缆';next.memory.memories[0].sources.push({sourceProjectId:'other',sourceRowId:'new'});next.revision++;
 assert.ok(!rec.scan(next).some(r=>r.id===pair.id),'unrelated changes and duplicate confirmation sources do not disturb independence');
 next.memory.memories.push(record('new','a','另一材料'));assert.ok(rec.scan(next).some(r=>r.id===pair.id),'new effective material evidence allows a new recommendation');
 assert.throws(()=>rec.dismiss(s,{categoryIds:['a','b'],evidenceKey:'stale'},items),/变化|刷新/);
 assert.throws(()=>rec.dismiss(s,{categoryIds:['a','a'],evidenceKey:pair.evidenceKey},items),/分类|候选/);
});
test('paginated recommendations stay bounded when many category pairs are similar',()=>{
 const s=fixture();s.library.categories=Array.from({length:119},(_,i)=>({id:'category-'+String(i).padStart(3,'0'),name:'测试阀门分类'+i}));s.memory.history=Array.from({length:10267},()=>({detail:'历史'.repeat(300)}));
 const items=rec.scan(s),page=rec.page(s,{page:2,pageSize:10000},items);assert.ok(items.length>50);assert.equal(page.items.length,50);assert.ok(Buffer.byteLength(JSON.stringify(page))<100000);assert.equal(rec.page(s,{page:9999},items).items.length,0);
});
