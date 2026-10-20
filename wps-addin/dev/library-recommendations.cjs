const crypto=require('node:crypto'),memory=require('../src/category-memory.js');
const normalize=x=>String(x||'').normalize('NFKC').toLowerCase().replace(/[\s、，,\-_/（）()]/g,'');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const unique=x=>Array.from(new Set(x)).sort();
function ruleKey(rule){
 const conditions=list=>(list||[]).map(c=>[c.field,unique(c.any||[])]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 return hash([conditions(rule.match),conditions(rule.exclude),unique(rule.aliases||[])]);
}
function lcs(a,b){
 a=a.slice(0,120);b=b.slice(0,120);const row=new Uint16Array(b.length+1);
 for(const ca of a){let previous=0;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=ca===b[j-1]?previous+1:Math.max(row[j],row[j-1]);previous=old;}}
 return row[b.length];
}
function intersects(a,b){for(const key of a)if(b.has(key))return true;return false;}
function scan(state){
 const groups=new Map();
 for(const c of state.library.categories){if(c.id==='no-inquiry'||['archived','disabled'].includes(c.state))continue;
  groups.set(c.id,{id:c.id,name:c.name,normal:normalize(c.name),aliases:unique((c.aliases||[]).map(normalize)),ruleKeys:new Set(),signatures:new Set(),rules:0,memories:0,examples:[]});}
 for(const r of state.library.rules){const g=groups.get(r.categoryId);if(!g||r.state==='disabled')continue;g.rules++;g.ruleKeys.add(ruleKey(r));}
 for(const m of state.memory.memories){const g=groups.get(m.categoryId);if(!g||m.state!=='active')continue;
  const key=hash([m.scope||'global',m.projectId||null,memory.signature(m.item)]);g.memories++;
  if(!g.signatures.has(key)&&g.examples.length<2)g.examples.push({name:String(m.item.name||'').slice(0,80),feature:String(m.item.feature||'').slice(0,160),unit:String(m.item.unit||'').slice(0,32)});
  g.signatures.add(key);
 }
 const categories=Array.from(groups.values()).sort((a,b)=>a.id.localeCompare(b.id)),items=[],dismissed=new Map((state.library.mergeDismissals||[]).map(d=>[d.pairKey,d.evidenceKey]));
 for(const g of categories)g.fingerprint=hash([g.normal,g.aliases,unique(g.ruleKeys),unique(g.signatures)]);
 for(let i=0;i<categories.length;i++)for(let j=i+1;j<categories.length;j++){
  const a=categories[i],b=categories[j],reasons=[];let score=0;
  if(a.normal===b.normal){reasons.push('规范化名称相同');score+=5;}
  if(a.aliases.includes(b.normal)||b.aliases.includes(a.normal)){reasons.push('已有历史别名对应');score+=4;}
  if(intersects(a.signatures,b.signatures)){reasons.push('相同材料曾分到两个分类');score+=4;}
  const shared=lcs(a.normal,b.normal),nameSimilar=shared>=2&&shared/Math.min(a.normal.length,b.normal.length)>=0.8&&shared/Math.max(a.normal.length,b.normal.length)>=0.5;
  if(nameSimilar&&a.normal!==b.normal){reasons.push('名称相近，可能是同类或上下位分类，需人工核对');score++;}
  if(nameSimilar&&intersects(a.ruleKeys,b.ruleKeys)){reasons.push('名称相近且有效关键词规则重叠');score+=2;}
  if(!reasons.length)continue;
  const id=JSON.stringify([a.id,b.id]),evidenceKey=hash([a.fingerprint,b.fingerprint]);if(dismissed.get(id)===evidenceKey)continue;
  const brief=g=>({id:g.id,name:g.name,rules:g.rules,memories:g.memories,examples:g.examples});
  items.push({id,evidenceKey,categories:[brief(a),brief(b)],reasons,strength:score>1?'strong':'name-only',score});
 }
 return items.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).map(({score,...item})=>item);
}
function page(state,query={},items=scan(state)){
 const n=query.page==null?1:Number(query.page);if(!Number.isSafeInteger(n)||n<1)throw Error('页码无效。');
 const size=Math.min(50,Math.max(1,Number.isSafeInteger(query.pageSize)?query.pageSize:10));
 return {revision:state.revision,page:n,pageSize:size,total:items.length,items:items.slice((n-1)*size,n*size)};
}
function dismiss(state,operation,items=scan(state)){
 const ids=operation.categoryIds;if(!Array.isArray(ids)||ids.length!==2||ids.some(id=>typeof id!=='string')||ids[0]===ids[1])throw Error('请选择两个不同的候选分类。');
 const pairKey=JSON.stringify(ids.slice().sort((a,b)=>a.localeCompare(b))),pair=items.find(item=>item.id===pairKey);
 if(!pair||pair.evidenceKey!==operation.evidenceKey)throw Error('推荐证据已变化，请刷新后重新核对。');
 const at=new Date().toISOString(),library={...state.library,version:'local-'+at,mergeDismissals:(state.library.mergeDismissals||[]).filter(d=>d.pairKey!==pairKey).concat([{pairKey,evidenceKey:pair.evidenceKey,at}])};
 const memory={...state.memory,updatedAt:at,history:state.memory.history.concat([{at,action:'library-keep-separate',categoryIds:ids.slice(),evidenceKey:pair.evidenceKey}])};
 return {...state,library,memory};
}
module.exports={scan,page,dismiss};
