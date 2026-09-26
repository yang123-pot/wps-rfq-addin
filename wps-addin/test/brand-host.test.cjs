const test=require('node:test'),assert=require('node:assert/strict');
const host=require('../src/brand-host.js'),model=require('../src/brand-model.js');
const binding={schemaVersion:1,path:'C:\\out\\分类品牌表.xlsx',sheet:'分类品牌表',headerRow:2,firstRow:3,inputKey:'ck1-brand',
 rowMap:{'a-1':{categoryId:'water-valve',categoryName:'水阀门',rowIds:['row-1'],count:1},
  'a-2':{categoryId:'water-valve',categoryName:'水阀门',rowIds:['row-2'],count:1}}};
const header=['分配标识','类别','材料条目数','品牌','供应商','备注','材料行标识'];
function values(rows){
 return [['分类品牌表'],header].concat(rows);
}
const rows=[['a-1','水阀门','1','品牌甲','供应商A','备注一','row-1'],['a-2','水阀门','1','品牌乙','供应商B','','row-2']];
function sheet(name,grid){return {Name:name,UsedRange:{Value2:grid}};}
function book(path,sheets){return {FullName:path,_closed:false,
 Worksheets:{Count:sheets.length,Item(index){return sheets[index-1];}},
 Close(){this._closed=true;}};}
function app(books){return {Workbooks:{Count:books.length,Item(index){return books[index-1];},
 Open(path){const found=books.filter(b=>b.FullName.toLowerCase()===String(path).toLowerCase())[0];return found||null;}}};}
test('reading a brand table that is already open reuses the workbook and does not close it',()=>{
 const open=book(binding.path,[sheet('分类品牌表',values(rows))]);
 const result=host.read(app([open]),binding);
 assert.deepEqual(result.assignments.map(item=>[item.assignmentId,item.brand,item.supplier,item.note]),
  [['a-1','品牌甲','供应商A','备注一'],['a-2','品牌乙','供应商B','']]);
 assert.equal(result.path,binding.path);
 assert.equal(result.inputKey,'ck1-brand');
 assert.equal(open._closed,false,'已打开的用户工作簿不得被关闭');
});
test('a brand table that is not open is opened read-only and closed after reading',()=>{
 const stored=book(binding.path,[sheet('分类品牌表',values(rows))]);
 const opened=[];
 const application={Workbooks:{Count:0,Item(){return null;},Open(path){
  const found=stored.FullName.toLowerCase()===String(path).toLowerCase()?stored:null;if(found)opened.push(path);return found;}}};
 const result=host.read(application,binding);
 assert.equal(result.assignments.length,2);
 assert.deepEqual(opened,[binding.path]);
 assert.equal(stored._closed,true,'插件自己打开的只读工作簿必须关闭');
});
test('a single-cell used range is normalised instead of crashing',()=>{
 assert.deepEqual(host.valuesOf({UsedRange:{Value2:'只有一格'}}),[['只有一格']]);
 assert.deepEqual(host.valuesOf({UsedRange:{Value2:[['a'],['b']]}}),[['a'],['b']]);
 assert.deepEqual(host.valuesOf({UsedRange:{Value2:[['a','b']]}}),[['a','b']]);
});
test('duplicate identifiers, missing sheets and missing workbooks are refused',()=>{
 const duplicate=book(binding.path,[sheet('分类品牌表',values(rows.concat([rows[0].slice()])))]);
 const before=JSON.stringify(binding);
 assert.throws(()=>host.read(app([duplicate]),binding),/标识/);
 assert.equal(JSON.stringify(binding),before,'读取失败不得改动绑定');
 const wrongSheet=book(binding.path,[sheet('别的表',values(rows))]);
 assert.throws(()=>host.read(app([wrongSheet]),binding),/缺少工作表/);
 assert.throws(()=>host.read(app([]),binding),/未返回指定品牌表/);
 assert.throws(()=>host.read(app([duplicate]),{...binding,schemaVersion:7}),/绑定无效/);
});
test('R7：汇总表写入沿用独占发布路径，打开支持复用已打开的同路径工作簿',()=>{
 // summaryWrite与内部清单写入同一条独占发布路径：非法暂存路径必须在写入前就被拒绝。
 assert.throws(()=>host.summaryWrite({AutomationSecurity:1,FileSystem:{Exists:()=>false},Workbooks:{Count:0}},
  {sheets:[]},'relative.xlsx'),/暂存路径无效/);
 const target={FullName:'C:\\out\\分类汇总表.xlsx',Activate(){this.activated=true;}};
 const opened=host.openSummary({AutomationSecurity:1,Workbooks:{Count:1,Item(){return target;},Open(){throw Error('must reuse');}}},
  target.FullName);
 assert.deepEqual(opened,{path:target.FullName,opened:true,reused:true});
 assert.equal(target.activated,true,'同名已打开工作簿直接复用并置前');
});
test('R8：读回分类汇总表，复用已打开工作簿、未打开则只读打开后关闭，解析成品牌口径',()=>{
 const root='C:\\out\\示例园区';
 const categories=[{categoryId:'pump',categoryName:'水泵',rowCount:2,path:root+'\\分类工作簿\\水泵.xlsx'},
  {categoryId:'valve',categoryName:'阀门',rowCount:2,path:root+'\\分类工作簿\\阀门.xlsx'}];
 const plan=model.summaryPlan(categories,{directory:root,inputKey:'ck2-host',layout:'separated',projectName:'示例园区'});
 const workbook=model.buildSummary(plan,{});
 const spec=model.summaryLayoutFor('separated');
 const grid=workbook.sheets[0].values.map(row=>row.slice());
 grid[spec.firstRow-1][3]='青源';grid[spec.firstRow-1][4]='华川设备';
 grid[spec.firstRow-1][5]='恒流';grid[spec.firstRow-1][6]='启明机电';
 grid[spec.firstRow-1][spec.modeColumn-1]='按品牌分别生成';
 grid[spec.firstRow][3]='通达';grid[spec.firstRow][4]='正通商贸';grid[spec.firstRow][spec.modeColumn-1]='合成一份';
 const binding=model.summaryBindingFor(root+'\\分类汇总表.xlsx',workbook);
 const open=book(binding.path,[sheet('分类汇总表',grid)]);
 const result=host.readSummary(app([open]),binding);
 assert.equal(result.ok,true,(result.issues[0]||{}).message);
 assert.equal(result.expectedSheets,3,'水泵2份＋阀门1份');
 assert.deepEqual(result.categories.map(item=>[item.categoryId,item.mode,item.groups.map(entry=>entry.brand)]),
  [['pump','per-brand',['青源','恒流']],['valve','synthesize',['通达']]]);
 assert.equal(open._closed,false,'已打开的用户工作簿不得被关闭');
 const stored=book(binding.path,[sheet('分类汇总表',grid)]);
 const application={Workbooks:{Count:0,Item(){return null;},Open(path){
  return stored.FullName.toLowerCase()===String(path).toLowerCase()?stored:null;}}};
 assert.equal(host.readSummary(application,binding).ok,true);
 assert.equal(stored._closed,true,'插件自己打开的只读汇总表必须关闭');
 assert.throws(()=>host.readSummary(app([]),binding),/未返回指定品牌表/);
 assert.throws(()=>host.readSummary(app([open]),Object.assign({},binding,{schemaVersion:7})),/绑定无效/);
});
