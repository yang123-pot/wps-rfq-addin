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
