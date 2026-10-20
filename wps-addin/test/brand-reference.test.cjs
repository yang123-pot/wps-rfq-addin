const test=require('node:test'),assert=require('node:assert/strict');
const reference=require('../src/brand-reference.js');
// 结构与本机“项目三材料分类.xlsx”的汇总表一致：序号／名称／…／备注，备注列写品牌。
function snapshot(){
 const values=[['序号','名称','中标除税价','采购除税价','备注'],
  [1,'防火板!A1','0','0',''],
  [2,'风机!A1','0','0','亿利达'],
  [3,'泵!A1','0','0','荏原、格兰富'],
  [4,'阀门!A1','0','0',''],
  [null,null,null,null,null],
  [6,null,'0','0','没有类别的行']];
 return {name:'项目三材料分类.xlsx',path:'C:\\分类\\项目三材料分类.xlsx',
  sheets:[{name:'汇总',values:values},{name:'风机',values:[['离心式通风机']]}]};
}
const mapping={sheet:'汇总',headerRow:1,categoryColumn:2,brandColumn:5};
test('parse reads the category and brand columns and keeps the source row numbers',()=>{
 const parsed=reference.parse(snapshot(),mapping);
 assert.equal(parsed.sheet,'汇总');
 assert.deepEqual(parsed.header,[{column:1,label:'序号'},{column:2,label:'名称'},{column:3,label:'中标除税价'},
  {column:4,label:'采购除税价'},{column:5,label:'备注'}]);
 assert.deepEqual(parsed.rows.map(row=>[row.sheetRow,row.category,row.brand]),
  [[2,'防火板!A1',''],[3,'风机!A1','亿利达'],[4,'泵!A1','荏原、格兰富'],[5,'阀门!A1','']]);
 assert.deepEqual(parsed.rows[2].brands,['荏原','格兰富'],'多品牌文本拆成候选但保留原文');
 assert.deepEqual(parsed.issues.map(item=>item.code),['category-missing'],'缺少类别的行只报告不纳入');
});
test('a missing or wrong mapping is refused instead of guessed',()=>{
 assert.throws(()=>reference.parse(snapshot(),null),/列映射无效/);
 assert.throws(()=>reference.parse(snapshot(),{sheet:'没有这张表',headerRow:1,categoryColumn:2,brandColumn:5}),/找不到工作表/);
 assert.throws(()=>reference.parse(snapshot(),{sheet:'汇总',headerRow:99,categoryColumn:2,brandColumn:5}),/超过工作表行数/);
 assert.throws(()=>reference.parse(snapshot(),{sheet:'汇总',headerRow:1,categoryColumn:0,brandColumn:5}),/categoryColumn/);
 const wrongColumn=reference.parse(snapshot(),{sheet:'汇总',headerRow:1,categoryColumn:1,brandColumn:3});
 assert.equal(wrongColumn.rows.length,5,'列映射由用户确认，插件只如实呈现');
 assert.deepEqual(wrongColumn.rows[1].category,'2');
});
test('an empty table and duplicated rows are reported',()=>{
 const empty={name:'空表.xlsx',path:'C:\\分类\\空表.xlsx',sheets:[{name:'汇总',values:[['序号','名称','备注']]}]};
 assert.match(reference.parse(empty,mapping).issues.map(item=>item.code).join('；'),/empty-table/);
 const duplicated={name:'重复.xlsx',path:'C:\\分类\\重复.xlsx',sheets:[{name:'汇总',
  values:[['序号','名称','中标除税价','采购除税价','备注'],
   [1,'风机!A1','0','0','亿利达'],[2,'风机!A1','0','0','亿利达']]}]};
 const parsed=reference.parse(duplicated,mapping);
 assert.equal(parsed.rows.length,2);
 assert.match(parsed.issues.map(item=>item.message).join('；'),/第2行与第3行重复：风机!A1／亿利达/);
});
test('search only filters the read-only view',()=>{
 const parsed=reference.parse(snapshot(),mapping);
 assert.equal(reference.search(parsed,'亿利达').length,1);
 assert.equal(reference.search(parsed,'荏原').length,1);
 assert.equal(reference.search(parsed,'').length,parsed.rows.length);
 assert.equal(reference.search(parsed,'没有这个词').length,0);
 const before=JSON.stringify(parsed);
 reference.search(parsed,'亿利达');
 assert.equal(JSON.stringify(parsed),before,'查看与搜索不得改动解析结果');
});
test('reading opens the reference workbook read-only and closes it again',()=>{
 const stored={FullName:'C:\\分类\\项目三材料分类.xlsx',_closed:false,
  Worksheets:{Count:2,Item(index){return index===1?{Name:'汇总',UsedRange:{Value2:[['序号','名称','备注']]}}
   :{Name:'风机',UsedRange:{Value2:[['离心式通风机']]}};}},
  Close(){this._closed=true;}};
 const opened=[];
 const app={Workbooks:{Count:0,Item(){return null;},Open(path){opened.push(path);return stored;}}};
 const snapshotRead=reference.read(app,stored.FullName);
 assert.deepEqual(reference.sheetNames(snapshotRead),['汇总','风机']);
 assert.deepEqual(snapshotRead.sheets[1].values,[['离心式通风机']],'单格工作表也要规整成二维数组');
 assert.deepEqual(opened,[stored.FullName]);
 assert.equal(stored._closed,true,'只读打开后必须关闭');
 const open={FullName:stored.FullName,_closed:false,Worksheets:stored.Worksheets,Close(){this._closed=true;}};
 reference.read({Workbooks:{Count:1,Item(){return open;}}},stored.FullName);
 assert.equal(open._closed,false,'用户自己打开的文件不得关闭');
 assert.throws(()=>reference.read({Workbooks:{Count:0,Item(){return null;},Open(){return null;}}},stored.FullName),/未返回指定品牌参考表/);
 assert.throws(()=>reference.read(null,stored.FullName),/需要连接WPS/);
});
