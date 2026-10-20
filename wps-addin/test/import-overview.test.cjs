const test=require('node:test'),assert=require('node:assert/strict');
const sample=require('./fixtures/workflow-v3-sample.cjs');
const model=require('../src/import-preview-model.js'),collection=require('../src/collection.js');
function rows(result){return result.sheets[0].values.filter(row=>/^\d+$/.test(row[0]));}
test('TRIAL-001：选择整理方式始终只更新目录统计，不生成合并明细或铺开材料行',()=>{
 const source=sample.buildCollection(),before=JSON.stringify(source);
 for(const previewOnly of [true,false]){
  const result=model.build(source,true,{projectName:'示例园区',previewOnly,mergeAllWorkbooks:true});
  assert.deepEqual(result.sheets.map(s=>s.name),['导入预览']);
  assert.equal(result.inputCount,10);assert.equal(result.outputCount,8);assert.equal(result.sheetCount,2);
  assert.deepEqual(rows(result).map(row=>[row[1],row[2],row[5]]),[
   ['给排水清单.xlsx','给排水','5'],['机电清单.xlsx','机电安装','5']]);
  assert.match(result.sheets[0].values.flat().join(' '),/原始 10 条.*预计整理后 8 条.*减少 2 条/);
  assert.equal(result.sheets[0].values.flat().includes('DN50'),false,'预览不铺开材料特征明细');
 }
 assert.equal(JSON.stringify(source),before,'统计不能改写来源、小标题或材料顺序');
});
test('TRIAL-001：同文件十张工作表遵循原标签顺序，标题不计材料数，跨表重复只影响总预计数',()=>{
 const names=['1','2','3','4','5','6','7','8','9','10'];
 const sheets=names.map((name,index)=>({name,startRow:1,startColumn:1,rowCount:4,columnCount:5,values:[
  ['工程名称：单体'+name,'','','',''],['项目编码','项目名称','项目特征描述','单位','工程量'],
  ['','暖通','','',''],['F'+name,'风机','规格'+(index===9?'1':name),'台','1']]}));
 const source=collection.add(collection.create(),[{metadata:{originalName:'十表清单.xlsx',originalPath:'C:\\samples\\十表清单.xlsx',
  copyPath:'C:\\copies\\十表清单.xlsx',fingerprint:'c'.repeat(64)},snapshot:{name:'十表清单.xlsx',path:'C:\\samples\\十表清单.xlsx',
  fingerprint:'c'.repeat(64),sheets}}]);
 const before=JSON.stringify(source),result=model.build(source,true,{});
 assert.equal(result.sheetCount,10);assert.equal(result.inputCount,10);assert.equal(result.outputCount,9);
 assert.deepEqual(result.sourceCopies.map(book=>book.sheets.map(sheet=>sheet.sourceName)),[['1','2','3','4','5','6','7','8','9','10']],
  '统计页后必须附带全部原工作表的原生复制计划，不能只保留磁盘原件');
 assert.equal(result.sourceCopies[0].copyPath,'C:\\copies\\十表清单.xlsx');
 assert.equal(result.sourceCopies[0].originalPath,'C:\\samples\\十表清单.xlsx');
 assert.deepEqual(rows(result).map(row=>row[2]),['1','2','3','4','5','6','7','8','9','10']);
 assert.equal(rows(result)[0][3],'单体1');assert.equal(rows(result)[9][3],'单体10');
 assert.match(rows(result)[0][4],/暖通/);assert.equal(rows(result).every(row=>row[5]==='1'),true);
 assert.deepEqual(result.sheets[0].layout.rows,[{index:1,height:32}],
  '统计数据行不得再写死行高，必须交给宿主按换行内容撑高');
 const changed=JSON.parse(before);[changed.entries[0].snapshot.sheets[1],changed.entries[0].snapshot.sheets[9]]=
  [changed.entries[0].snapshot.sheets[9],changed.entries[0].snapshot.sheets[1]];
 assert.deepEqual(rows(model.build(changed,false,{})).map(row=>row[2]),['1','10','3','4','5','6','7','8','9','2'],
  '原标签若非编号顺序，也不能擅自排序');
 assert.equal(JSON.stringify(source),before);
});
test('TRIAL-001：关闭相同材料合并保留原条数；空表与问题提示只归属于对应工作表',()=>{
 const source=sample.buildCollection();
 source.entries[0].snapshot.sheets.push({name:'空表',startRow:1,startColumn:1,rowCount:0,columnCount:0,values:[]});
 source.entries[0].parsed.issues.push({sheet:'给排水',code:'source-unresolved',severity:'review',row:3,message:'来源待核对'});
 const result=model.build(source,false,{previewOnly:true});
 assert.equal(result.inputCount,10);assert.equal(result.outputCount,10);
 const data=rows(result);assert.deepEqual(data.map(row=>row[2]),['给排水','空表','机电安装']);
 assert.match(data[0][6],/待核对/);assert.equal(data[1][5],'0');assert.match(data[1][6],/未识别到材料/);
 assert.equal(data[1][3],'待核对');assert.doesNotMatch(data[2][6],/待核对/);
 assert.match(result.sheets[0].values.flat().join(' '),/不累加/);
});

test('原表浏览：来源表名与统计页/预留原表名前缀冲突时仍全部保留',()=>{
 const input=JSON.parse(JSON.stringify(sample.inputs[0]));
 input.snapshot.sheets=[{...input.snapshot.sheets[0],name:'导入预览'},
  {...input.snapshot.sheets[0],name:'原表_导入预览'}];
 const source=collection.add(collection.create(),[input]);
 const plan=model.build(source,false,{}).sourceCopies[0].sheets;
 assert.deepEqual(plan.map(sheet=>sheet.sourceName),['导入预览','原表_导入预览']);
 assert.deepEqual(plan.map(sheet=>sheet.previewName),['原表_导入预览','原表_导入预览_2']);
});
