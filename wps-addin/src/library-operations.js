(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./category-library.js'),require('./category-memory.js'));
 else root.RfqLibraryOperations=factory(root.RfqCategoryLibrary,root.RfqCategoryMemory);
}(typeof window==='object'?window:globalThis,function(lib,mem){
 'use strict';
 function clone(x){return JSON.parse(JSON.stringify(x));}
 function normalize(x){return String(x||'').normalize('NFKC').toLowerCase().replace(/[\s、，,\-_/（）()]/g,'');}
 function unique(list){return Array.from(new Set(list.filter(Boolean)));}
 function category(s,id){var c=s.library.categories.find(function(c){return c.id===id;});if(!c)throw Error('分类不存在。');return c;}
 function editable(s,id){var c=category(s,id);if(id===lib.DECISION)throw Error('固定分类“无需询价”不可修改、归档或合并。');return c;}
 function active(c){return c.state!=='archived'&&c.state!=='disabled';}
 function related(s,id){return {rules:s.library.rules.filter(function(r){return r.categoryId===id;}).length,
  memories:s.memory.memories.filter(function(m){return m.categoryId===id;}).length};}
 function previewMerge(s,ids,targetId){
  var target=editable(s,targetId);if(!active(target))throw Error('目标分类必须有效。');
  ids=unique(Array.isArray(ids)?ids:[]);if(!ids.length)throw Error('请选择源分类。');
  if(ids.indexOf(targetId)>=0)throw Error('目标不能同时作为源分类。');
  var rules=0,memories=0,aliases=(target.aliases||[]).slice();
  ids.forEach(function(id){var c=editable(s,id);if(c.mergedInto)throw Error('源分类已经合并。');var n=related(s,id);rules+=n.rules;memories+=n.memories;aliases=aliases.concat(c.name,c.aliases||[]);});
  return {sourceIds:ids,targetId:targetId,rules:rules,memories:memories,aliases:unique(aliases),requiresConfirmation:true};
 }
 function canonicalRule(r){
  function conditions(list){return (list||[]).map(function(c){return {field:c.field,any:unique(c.any||[]).sort()};}).sort(function(a,b){return JSON.stringify(a).localeCompare(JSON.stringify(b));});}
  return JSON.stringify([r.categoryId,r.state||'active',conditions(r.match),conditions(r.exclude),unique(r.aliases||[]).sort()]);
 }
 function dedupe(s){
  var rules=new Map();s.library.rules.forEach(function(r){var key=canonicalRule(r),old=rules.get(key);if(!old)rules.set(key,r);else old.mergedRuleIds=unique((old.mergedRuleIds||[]).concat(r.id,r.mergedRuleIds||[]));});s.library.rules=Array.from(rules.values());
  var records=new Map();s.memory.memories.forEach(function(m){var key=JSON.stringify([m.state,m.scope||'global',m.projectId||null,m.categoryId,mem.signature(m.item)]),old=records.get(key);
   if(!old){records.set(key,m);return;}
   var sources=new Map();(old.sources||[]).concat(m.sources||[]).forEach(function(ref){sources.set(JSON.stringify([ref.sourceProjectId,ref.sourceRowId,ref.decisionRevision]),ref);});old.sources=Array.from(sources.values());old.mergedMemoryIds=unique((old.mergedMemoryIds||[]).concat(m.id,m.mergedMemoryIds||[]));
  });s.memory.memories=Array.from(records.values());
 }
 function apply(state,operation){
  var s=clone(state),op=operation||{},at=new Date().toISOString(),c,target;
  if(op.type==='add'||op.type==='rename'){
   var name=String(op.name||'').trim();if(!name||name.length>120)throw Error('分类名称需为1至120字。');
   if(s.library.categories.some(function(c){return c.id!==op.categoryId&&(normalize(c.name)===normalize(name)||(c.aliases||[]).some(function(a){return normalize(a)===normalize(name);}));}))throw Error('已存在重名分类或历史别名，请查看合并候选。');
   if(op.type==='add')s.library.categories.push({id:lib.newId(s.library,'category'),name:name,state:'active',aliases:[]});
   else{c=editable(s,op.categoryId);if(!active(c))throw Error('归档分类不可重命名。');c.aliases=unique((c.aliases||[]).concat(c.name));c.name=name;s.memory.memories.forEach(function(m){if(m.categoryId===c.id)m.categoryName=name;});}
  }else if(op.type==='archive'){
   c=editable(s,op.categoryId);var counts=related(s,c.id);if(counts.rules||counts.memories)throw Error('分类有关联规则或学习经验，请先合并或清理关联数据。');c.state='archived';c.archivedAt=at;
  }else if(op.type==='merge'){
   var p=previewMerge(s,op.sourceIds,op.targetId);if(op.confirmed!==true)throw Error('合并必须由用户确认。');target=category(s,p.targetId);target.aliases=p.aliases;
   p.sourceIds.forEach(function(id){c=category(s,id);c.state='archived';c.archivedAt=at;c.mergedInto=target.id;});
   s.library.rules.forEach(function(r){if(p.sourceIds.indexOf(r.categoryId)>=0)r.categoryId=target.id;});
   s.memory.memories.forEach(function(m){if(p.sourceIds.indexOf(m.categoryId)>=0){m.previousCategoryIds=unique((m.previousCategoryIds||[]).concat(m.categoryId));m.categoryId=target.id;m.categoryName=target.name;}});
   s.memory.history.forEach(function(h){if(p.sourceIds.indexOf(h.categoryId)>=0){h.previousCategoryId=h.categoryId;h.categoryId=target.id;}});dedupe(s);
  }else if(op.type==='revoke')s.memory=mem.revoke(s.memory,op.memoryId);
  else throw Error('未知分类库操作。');
  s.library.version='local-'+at;s.memory.updatedAt=at;
  s.memory.history.push({at:at,action:'library-'+op.type,categoryId:op.categoryId||op.targetId||null,sourceIds:op.sourceIds||[],name:op.name||null});
  var check=lib.validate(s.library);if(!check.ok)throw Error(check.errors.join('；'));mem.assertValid(s.memory);return s;
 }
 function similar(s,id){
  var source=category(s,id),name=normalize(source.name),a=new Set(s.memory.memories.filter(function(m){return m.categoryId===id&&m.state==='active';}).map(function(m){return mem.signature(m.item);}));
  return s.library.categories.filter(function(c){return c.id!==id&&c.id!==lib.DECISION&&active(c);}).map(function(c){
   var reasons=[],other=normalize(c.name);if(name===other)reasons.push('规范化名称相同');
   if((c.aliases||[]).concat(source.aliases||[]).some(function(x){return normalize(x)===name||normalize(x)===other;}))reasons.push('已有历史别名');
   var overlap=s.memory.memories.some(function(m){return m.categoryId===c.id&&m.state==='active'&&a.has(mem.signature(m.item));});if(overlap)reasons.push('相同材料曾落入不同类别');
   var chars=new Set(name.split('')),shared=other.split('').filter(function(ch){return chars.has(ch);}).length;
   if(shared/Math.max(name.length,other.length)>=0.75&&name!==other&&overlap)reasons.push('名称高度相似且学习材料重叠');
   return {categoryId:c.id,name:c.name,reasons:reasons,requiresConfirmation:true};
  }).filter(function(c){return c.reasons.length;});
 }
 return {apply:apply,previewMerge:previewMerge,similar:similar,normalize:normalize,related:related};
}));
