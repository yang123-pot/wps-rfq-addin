const test=require('node:test'),assert=require('node:assert/strict');
const ops=require('../src/library-operations.js');
const library=require('../src/category-library.js'),memory=require('../src/category-memory.js');
function fixture(){return {library:{version:'v1',categories:[{id:'a',name:'水 阀',state:'active'},{id:'b',name:'水阀',state:'active'},{id:'c',name:'空类',state:'active'},{id:'no-inquiry',name:'无需询价'}],rules:[{id:'r1',categoryId:'a',match:[{field:'name',any:['阀']}],state:'active'},{id:'r2',categoryId:'b',match:[{field:'name',any:['阀']}],state:'active'}]},memory:{...memory.create(),memories:['a','b'].map((categoryId,i)=>({id:'m'+i,item:{name:'阀',feature:'DN50',unit:'个'},categoryId,categoryName:categoryId,scope:'global',projectId:null,state:'active',learnedAt:'2026-10-20',sources:[{sourceProjectId:'p'+i,sourceRowId:'r'}]}))}};}
test('archive is immutable, retains old names, hides future suggestions, blocks associated data and fixed decision',()=>{
 const s=fixture(),before=JSON.stringify(s);
 assert.throws(()=>ops.apply(s,{type:'archive',categoryId:'a'}),/关联|合并/);
 assert.throws(()=>ops.apply(s,{type:'archive',categoryId:'no-inquiry'}),/无需询价/);
 const n=ops.apply(s,{type:'archive',categoryId:'c'});
 assert.equal(JSON.stringify(s),before);assert.equal(n.library.categories.find(x=>x.id==='c').state,'archived');
 assert.equal(library.validate(n.library).ok,true);assert.ok(!library.categories(n.library).some(x=>x.id==='c'));
 assert.equal(library.categoryName(n.library,'c'),'空类');
});
test('merge requires explicit confirmation, migrates aliases/rules/memories and deduplicates sources without changing old projects',()=>{
 const s=fixture(),project={categoryId:'a',categoryName:'水 阀'},before=JSON.stringify(s);
 const preview=ops.previewMerge(s,['a'],'b');assert.equal(preview.rules,1);assert.equal(preview.memories,1);
 assert.throws(()=>ops.apply(s,{type:'merge',sourceIds:['a'],targetId:'b'}),/确认/);
 const n=ops.apply(s,{type:'merge',sourceIds:['a'],targetId:'b',confirmed:true});
 assert.equal(JSON.stringify(s),before);assert.equal(project.categoryName,'水 阀');
 assert.equal(n.library.categories.find(x=>x.id==='a').mergedInto,'b');
 assert.ok(n.library.categories.find(x=>x.id==='b').aliases.includes('水 阀'));
 assert.equal(n.library.rules.length,1);assert.equal(n.memory.memories.length,1);assert.equal(n.memory.memories[0].sources.length,2);
 assert.equal(n.memory.memories[0].categoryId,'b');assert.ok(n.memory.history.length);
 assert.throws(()=>ops.previewMerge(s,['no-inquiry'],'b'),/无需询价/);
 assert.throws(()=>ops.previewMerge(s,['b'],'b'),/目标/);
});
test('similar categories return reasons only; rename retains alias, duplicate normalized name is refused',()=>{
 const s=fixture(),before=JSON.stringify(s),candidates=ops.similar(s,'a');
 assert.equal(candidates[0].categoryId,'b');assert.ok(candidates[0].reasons.length);assert.equal(JSON.stringify(s),before);
 assert.throws(()=>ops.apply(s,{type:'rename',categoryId:'c',name:'水阀'}),/重名|存在/);
 const n=ops.apply(s,{type:'rename',categoryId:'a',name:'给水阀'});
 assert.ok(n.library.categories[0].aliases.includes('水 阀'));assert.equal(n.memory.memories[0].categoryName,'给水阀');
 assert.equal(ops.apply(n,{type:'add',name:'新类'}).library.categories.length,5);
});
