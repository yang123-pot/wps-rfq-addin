(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./review.js'),require('./merge.js'));
  else root.RfqCollection=factory(root.RfqReview,root.RfqMerge);
}(typeof window==='object'?window:globalThis,function(review,merge){
  'use strict';
  function key(path){return String(path||'').replace(/[\\/]+/g,'/').toLowerCase();}
  function clone(value){return JSON.parse(JSON.stringify(value));}
  function create(){return {entries:[]};}
  function parse(snapshot,record){var result=review.apply(snapshot,record);result.fingerprint=snapshot.fingerprint;return result;}
  function add(collection,inputs){
    if(!Array.isArray(inputs)||!inputs.length||collection.entries.length+inputs.length>100)throw new Error('请添加有效工作簿，每次会话最多100份。');
    var paths=new Set(),fingerprints=new Set();
    collection.entries.forEach(function(e){paths.add(e.id);fingerprints.add(e.metadata.fingerprint.toLowerCase());});
    var added=inputs.map(function(input){
      var m=input.metadata,s=input.snapshot;
      if(!m||!s||!m.originalPath||!m.originalName||!m.copyPath||key(m.copyPath)===key(m.originalPath)||
        s.path!==m.originalPath||s.name!==m.originalName||s.fingerprint!==m.fingerprint||!/^[a-f\d]{64}$/i.test(m.fingerprint))throw new Error('工作副本与来源快照标识不一致。');
      var id=key(m.originalPath),fingerprint=m.fingerprint.toLowerCase();
      if(paths.has(id)||fingerprints.has(fingerprint))throw new Error('重复导入工作簿：'+m.originalName);
      paths.add(id);fingerprints.add(fingerprint);
      s=clone(s);var record=review.create(s);
      return {id:id,metadata:clone(m),snapshot:s,record:record,parsed:parse(s,record),dirty:false};
    });
    return {entries:collection.entries.concat(added)};
  }
  function update(collection,id,record,dirty){
    if(!collection.entries.some(function(e){return e.id===id;}))throw new Error('导入工作簿已移除，请重新选择。');
    return {entries:collection.entries.map(function(e){
      if(e.id!==id)return e;
      return {id:e.id,metadata:e.metadata,snapshot:e.snapshot,record:clone(record),parsed:parse(e.snapshot,record),dirty:dirty!==false};
    })};
  }
  function remove(collection,id){return {entries:collection.entries.filter(function(e){return e.id!==id;})};}
  function preview(collection,mergeIdentical){
    if(!collection.entries.length)return {mode:'separate',inputCount:0,outputCount:0,groups:[],issues:[],canFinalize:false};
    return merge.preview(collection.entries.map(function(e){return e.parsed;}),{mergeIdentical:mergeIdentical===true});
  }
  return {create:create,add:add,update:update,remove:remove,preview:preview};
}));
