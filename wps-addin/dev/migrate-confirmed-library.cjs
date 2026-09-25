const SCHEMA_VERSION=1;
const Memory=require('../src/category-memory.js');
function text(value){return value==null?'':String(value).trim();}
function signature(item){return [text(item&&item.name),text(item&&item.feature),text(item&&item.unit)].join('\u0000');}
// 别名必须由用户显式给出（Q8口径）；answer-overrides是行级修正，只能作为一致性检查，不能全局改写人工答案。
function aliasMap(aliases){
 const map={};
 (Array.isArray(aliases)?aliases:[]).forEach(function(entry){
  const from=text(entry&&entry.from),to=text(entry&&entry.to);
  if(from&&to)map[from.toLowerCase()]=to;
 });
 return map;
}
// 只统计“行级修正是否落在本次确认数据里”，不改变人工填写的类别。
function reviewOverrides(overrides,rows){
 const byRow={};
 (rows||[]).forEach(function(row){if(row&&row.excelRow!=null)byRow[String(row.excelRow)]=row;});
 const matched=[],unmatched=[];
 (Array.isArray(overrides)?overrides:[]).forEach(function(entry){
  const row=byRow[String(entry&&entry.row)];
  (row?matched:unmatched).push({row:entry&&entry.row,before:entry&&entry.before,after:entry&&entry.after});
 });
 return {matched:matched,unmatched:unmatched};
}
function categoryIndex(library){
 const byName={},byId={};
 ((library&&library.categories)||[]).forEach(function(category){
  const key=text(category.name).toLowerCase();
  if(key&&!byName[key])byName[key]=category;
  if(text(category.id))byId[text(category.id)]=category;
 });
 return {byName:byName,byId:byId};
}
// 只承认人工填写列为真的记录；未确认、缺类别、类别名不在现有库里的都单独列出，不猜不合并。
function buildMigration(input,library,options){
 const rows=(input&&input.rows)||[],map=aliasMap(options&&options.aliases),index=categoryIndex(library);
 const memories={},order=[],rejected=[],conflicts=[],categories={};
 rows.forEach(function(row){
  const recordId=text(row&&row.recordId)||('row-'+(rejected.length+conflicts.length+1));
  if(row&&row.confirmed!==true){rejected.push({recordId:recordId,reason:'未经人工确认'});return;}
  const item={name:text(row&&row.item&&row.item.name),feature:text(row&&row.item&&row.item.feature),
   unit:text(row&&row.item&&row.item.unit)};
  if(!item.name){rejected.push({recordId:recordId,reason:'缺少材料名称'});return;}
  const rawName=text(row&&row.categoryName);
  const categoryName=map[rawName.toLowerCase()]||rawName;
  if(!categoryName){rejected.push({recordId:recordId,reason:'缺少类别'});return;}
  categories[categoryName]=(categories[categoryName]||0)+1;
  const category=index.byName[categoryName.toLowerCase()]||index.byId[text(row&&row.categoryId)];
  if(!category){conflicts.push({recordId:recordId,categoryName:categoryName,needs:'类别名不在现有分类库，等待Q8口径'});return;}
  const key=category.id+'\u0000'+signature(item);
  if(!memories[key]){
   memories[key]={categoryId:category.id,categoryName:category.name,item:item,sources:[],recordIds:[]};
   order.push(key);
  }
  memories[key].sources.push({recordId:recordId,confirmationSource:text(row.confirmationSource)||'人工核对表'});
  memories[key].recordIds.push(recordId);
 });
 const list=order.map(function(key){return memories[key];});
 const variants={};
 conflicts.forEach(function(item){variants[item.categoryName]=(variants[item.categoryName]||0)+1;});
 return {schemaVersion:SCHEMA_VERSION,
  categories:Object.keys(categories).sort(function(a,b){return categories[b]-categories[a];})
   .map(function(name){return {categoryName:name,count:categories[name]};}),
  memories:list,rejected:rejected,conflicts:conflicts,
  wordingVariants:Object.keys(variants).sort(function(a,b){return variants[b]-variants[a];})
   .map(function(name){return {categoryName:name,count:variants[name]};}),
  overrides:reviewOverrides(input&&input.overrides,rows),
  summary:{total:rows.length,confirmed:rows.length-rejected.length,memories:list.length,
   mappable:list.reduce(function(total,item){return total+item.recordIds.length;},0),
   rejected:rejected.length,conflicts:conflicts.length,categoryNames:Object.keys(categories).length}};
}
// 真正写库前必须先由用户定下类别口径；这里只生成可核对的记忆包，不落盘、不改静态规则。
function toLibraryState(migration,currentLibrary,currentMemory){
 const learned=migration.memories.reduce(function(memory,entry){
  return entry.recordIds.reduce(function(inner,recordId){
   return Memory.learn(inner,{categoryId:entry.categoryId,categoryName:entry.categoryName,
    confirmedAt:'2026-09-26T00:00:00.000Z',rowId:recordId,
    libraryVersion:currentLibrary&&currentLibrary.version||null},
    {item:entry.item,sourceProjectId:'migration-20260920'});},memory);},currentMemory);
 return {library:currentLibrary,memory:learned};
}
module.exports={SCHEMA_VERSION:SCHEMA_VERSION,buildMigration:buildMigration,toLibraryState:toLibraryState,aliasMap:aliasMap,reviewOverrides:reviewOverrides};
