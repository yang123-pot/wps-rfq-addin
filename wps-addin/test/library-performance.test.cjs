const test=require('node:test'),assert=require('node:assert/strict'),query=require('../dev/library-query.cjs'),classify=require('../src/classify.js'),Memory=require('../src/category-memory.js');
test('13MB-scale history never enters page or classification index; repeated classification avoids full memory validation',()=>{
 const library={version:'perf',categories:Array.from({length:119},(_,i)=>({id:'cat-'+i,name:'类别'+i,state:'active'})),rules:[]},memory=Memory.create();
 memory.memories=Array.from({length:6760},(_,i)=>({id:'m-'+i,categoryId:'cat-'+i%119,categoryName:'类别'+i%119,item:{name:'材料'+i,feature:'特征'+i,unit:'个'},scope:'global',state:'active',sources:[{sourceProjectId:'perf',sourceRowId:'row-'+i}]}));
 memory.history=Array.from({length:10267},()=>({detail:'历史'.repeat(230)}));const state={revision:1,library,memory};assert.ok(Buffer.byteLength(JSON.stringify(state))>13.2*1024*1024);
 const start=performance.now(),index=query.classifyIndex(state),page=query.page(state,{kind:'memories'});assert.equal(page.items.length,50);assert.ok(Buffer.byteLength(JSON.stringify(index))<2*1024*1024);
 const before=Memory.validate;let validations=0;Memory.validate=function(s){validations++;return before(s);};
 try{for(let i=0;i<2000;i++){const result=classify.suggest({name:'材料'+i,feature:'特征'+i,unit:'个'},index.library,{memory:index.memory});assert.equal(result.conflicts.length,0);assert.equal(result.candidates[0].categoryId,'cat-'+i%119);}}
 finally{Memory.validate=before;}assert.equal(validations,0,'compact lookup must validate only once inside its index builder');
 const ms=performance.now()-start;assert.ok(ms<5000,'2000 materials should not rescan 13MB history');console.log(JSON.stringify({historyBytes:Buffer.byteLength(JSON.stringify(state)),indexBytes:Buffer.byteLength(JSON.stringify(index)),pageBytes:Buffer.byteLength(JSON.stringify(page)),classificationRows:2000,elapsedMs:Math.round(ms)}));
});
