(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.RfqDeferredLearning=factory();}(typeof window==='object'?window:globalThis,function(){
 'use strict';
 function key(review){return review&&JSON.stringify([review.inputKey,review.revision,review.confirmedAt]);}
 function verified(split){return !!(split&&split.files&&split.files.length&&split.files.every(function(f){return f.state==='succeeded'&&/^[a-f\d]{64}$/i.test(f.sha256||'')&&['publish','content-check'].indexOf(f.verifiedBy)>=0;}));}
 function pending(review,split,decision){return !!(review&&review.rows&&review.rows.length&&verified(split)&&(!decision||decision.confirmationKey!==key(review)||['saved','skipped'].indexOf(decision.status)<0));}
 function decide(review,status,extra){if(['saved','skipped','failed'].indexOf(status)<0)throw Error('学习决定无效。');return Object.assign({schemaVersion:1,confirmationKey:key(review),reviewInputKey:review.inputKey,reviewRevision:review.revision,status:status,at:new Date().toISOString()},extra||{});}
 return {key:key,verified:verified,pending:pending,decide:decide};
}));
