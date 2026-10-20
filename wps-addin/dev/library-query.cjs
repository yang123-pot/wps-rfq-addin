const lib=require('../src/category-library.js'),mem=require('../src/category-memory.js'),ops=require('../src/library-operations.js');
function summary(s){return {revision:s.revision,updatedAt:s.updatedAt,categories:lib.categories(s.library).length,archived:s.library.categories.filter(c=>c.state==='archived').length,rules:s.library.rules.length,memories:s.memory.memories.filter(m=>m.state==='active').length,history:s.memory.history.length};}
function page(s,q={}){
 const kind=q.kind||'categories';if(!['categories','memories','rules'].includes(kind))throw Error('分页类型无效。');
 const n=q.page==null?1:Number(q.page);if(!Number.isSafeInteger(n)||n<1)throw Error('页码无效。');
 const size=Math.min(50,Math.max(1,Number.isSafeInteger(q.pageSize)?q.pageSize:50)),search=String(q.search||'').trim().toLowerCase();
 let items=kind==='categories'?s.library.categories:kind==='rules'?s.library.rules:s.memory.memories;
 items=items.filter(x=>(!q.state||q.state==='all'||(x.state||'active')===q.state)&&(!q.categoryId||x.categoryId===q.categoryId)&&(!search||JSON.stringify(kind==='memories'?x.item:kind==='categories'?[x.name,x.aliases]:[x.match,x.basis]).toLowerCase().includes(search)));
 return {revision:s.revision,page:n,pageSize:size,total:items.length,items:items.slice((n-1)*size,n*size).map(x=>{
  if(kind==='categories')return {...x,...ops.related(s,x.id)};
  if(kind==='rules')return x;
  return {id:x.id,item:x.item,categoryId:x.categoryId,categoryName:lib.categoryName(s.library,x.categoryId),state:x.state,learnedAt:x.learnedAt,sourceCount:(x.sources||[]).length,sourceProjectId:(x.sources?.[0]||{}).sourceProjectId||null,sourceRowId:x.sourceRowId||null,sourceProjectName:x.sources?.[0]?.sourceProjectName||null,sourceRowSummary:x.sources?.[0]?.sourceRowSummary||null};
 })};
}
function classifyIndex(s){
 const allowed=new Set(lib.categories(s.library).map(c=>c.id)),seen=new Set();
 const records=[];
 for(const m of s.memory.memories){if(m.state!=='active'||!allowed.has(m.categoryId))continue;
  const key=JSON.stringify([m.scope||'global',m.projectId||null,mem.signature(m.item),m.categoryId]);if(seen.has(key))continue;seen.add(key);
  records.push({id:m.id,item:m.item,categoryId:m.categoryId,categoryName:lib.categoryName(s.library,m.categoryId),scope:m.scope||'global',projectId:m.projectId||null,state:'active'});
 }
 return {revision:s.revision,library:{version:s.library.version,categories:lib.categories(s.library),rules:lib.rules(s.library)},memory:{schemaVersion:1,version:s.memory.version,memories:records,history:[],compact:true}};
}
module.exports={summary,page,classifyIndex};
