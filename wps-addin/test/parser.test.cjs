const test = require('node:test');
const assert = require('node:assert/strict');
const {parseWorkbook} = require('../src/parser.js');
const {preview} = require('../src/merge.js');

const header = ['序号','项目编码','项目名称','项目特征描述','计量\n单位','工程量','综合单价','合价'];
function sheet(values, name='清单', startRow=1, startColumn=1) {
  const width = Math.max(...values.map(row=>row.length));
  return {name,startRow,startColumn,rowCount:values.length,columnCount:width,
    values:values.map(row=>Array.from({length:width},(_,i)=>row[i]??null))};
}
function parse(...sheets) {return parseWorkbook({name:'测试.xlsx',path:'C:\\样本\\测试.xlsx',sheets});}
function row(code='000123',name='管道',feature=' DN50\n含接头 ',unit='m',quantity='2.50') {
  return [1,code,name,feature,unit,quantity,123.45,246.9];
}
function codes(result) {return result.issues.map(issue=>issue.code);}

test('offset and reordered headers preserve source coordinates and exact material text without prices',()=>{
  const values=[['工程名称：一号楼给排水'],['工程量','单位','项目名称','项目特征','清单编码'],['2.50',' m ',' 管道 ',' A\n B ','000123']];
  const input={name:'样本.xlsx',path:'C:\\样本.xlsx',sheets:[sheet(values,'偏移',5,3)]};
  const before=JSON.stringify(input); const result=parseWorkbook(input); const item=result.materials[0];
  assert.equal(result.materials.length,1);
  assert.deepEqual([item.code,item.name,item.feature,item.unit,item.quantity],['000123',' 管道 ',' A\n B ',' m ','2.5']);
  assert.deepEqual([item.source.row,item.source.column,item.source.sequence,item.source.engineering,item.source.profession],
    [7,5,'','一号楼给排水','给排水'],'未映射序号列时明确留空，不伪造来源序号');
  assert.equal(JSON.stringify(input),before);
  assert.equal('price' in item,false);
  assert.equal('values' in item,false);
});
test('all sheets and repeated headers retain each material once including duplicate codes',()=>{
  const a=sheet([['工程名称：一号楼强电'],header,row(),header,row()],'强电');
  const b=sheet([['工程名称：二号楼给排水'],header,row()],'给排水');
  const result=parse(a,b);
  assert.equal(result.materials.length,3);
  assert.equal(new Set(result.materials.map(x=>x.id)).size,3);
  assert.deepEqual(result.sheets.map(x=>x.materialCount),[2,1]);
  assert.equal(result.sheets[0].audit.length,5);
  assert.deepEqual(result.sheets[0].headers.map(x=>x.row),[2,4]);
});
test('blank and unsupported sheets are explicitly accounted for',()=>{
  const result=parse(sheet([[null]],'空白'),sheet([['材料说明'],['未识别的表格']],'说明'));
  assert.equal(result.sheets[0].status,'empty');
  assert.equal(result.sheets[1].status,'unsupported');
  assert.ok(codes(result).includes('header-not-found'));
  assert.equal(result.materials.length,0);
});
test('incomplete or duplicate required headers block guessing column mappings',()=>{
  const partial=parse(sheet([['项目编码','项目名称','单位','工程量'],['0001','管道','m',1]]));
  assert.ok(codes(partial).includes('header-incomplete'));
  assert.equal(partial.materials.length,0);
  const duplicate=parse(sheet([[...header,'工程量'],[...row(),5]]));
  assert.ok(codes(duplicate).includes('header-ambiguous'));
  assert.equal(duplicate.materials.length,0);
});
test('missing material fields and invalid quantity remain visible candidates instead of disappearing',()=>{
  const result=parse(sheet([header,row('','管道'),row('002','','x','m','abc'),row('003','管道','x','',''),row('004','管道','x','m',0)]));
  assert.equal(result.materials.length,4);
  assert.ok(result.materials[0].issueCodes.includes('code-missing'));
  assert.ok(result.materials[1].issueCodes.includes('name-missing'));
  assert.ok(result.materials[2].issueCodes.includes('unit-missing'));
  assert.deepEqual(result.materials.map(x=>x.quantity),['2.5',null,'0','0']);
  assert.equal(result.materials[1].quantityRaw,'abc');
  assert.equal(result.materials[2].quantityRaw,'');
  assert.equal(result.materials[2].issueCodes.includes('quantity-invalid'),false,'空白工程量按0计入，不再阻断');
});
test('zero and blank quantities both remain classifiable material rows',()=>{
  const result=parse(sheet([header,row('001','管道','DN50','m',0),row('002','阀门','DN50','个','')]));
  assert.equal(result.materials.length,2);
  assert.deepEqual(result.materials.map(x=>x.quantity),['0','0']);
  assert.deepEqual(result.materials.map(x=>x.quantityRaw),[0,'']);
  assert.equal(result.issues.some(x=>x.code==='quantity-invalid'),false);
  const merged=preview([result],{mergeIdentical:true,mergeAllWorkbooks:true});
  assert.equal(merged.canFinalize,true,'0和空白都不得阻断进入分类');
  assert.deepEqual(merged.groups.map(x=>x.quantity),['0','0']);
});
test('quantity validation rejects partial parses, errors, negative and ambiguous separators',()=>{
  const quantities=['1,234.50','1,23','12m','待定','#VALUE!',-1,true,Infinity,0.0000001,' 0.10 '];
  const result=parse(sheet([header,...quantities.map((q,i)=>row('00'+i,'管道','','m',q))]));
  assert.deepEqual(result.materials.map(x=>x.quantity),['1234.5',null,null,null,null,null,null,null,'0.0000001','0.1']);
});
test('titles, subheaders and totals never become materials; unknown sections do not inherit stale profession',()=>{
  const result=parse(sheet([['工程名称：综合楼安装'],header,['','','电气系统'],row(),['','','内部'],row(),['','','附属工程'],row(),['','','火灾自动报警系统'],row(),['','','分部小计','','',5],['','','合计','','',10]]));
  assert.equal(result.materials.length,4);
  assert.deepEqual(result.materials.map(x=>x.source.profession),['强电','强电','','火灾报警']);
  assert.ok(result.materials[2].issueCodes.includes('source-unresolved'));
});
test('engineering changes reset context; generic material names and feature text cannot imply a profession',()=>{
  const result=parse(sheet([['工程名称：一号楼安装'],header,['','','给水系统'],row(),['工程名称：二号楼安装'],header,row('02','控制模块','消防电源模块','台'),['','','抗震支架（强电及消防电）'],row()]));
  assert.deepEqual(result.materials.map(x=>x.source.profession),['给排水','','']);
  assert.equal(result.materials[1].source.engineering,'二号楼安装');
});
test('missing discipline headings fall back to project item names with a visible inference basis',()=>{
  const result=parse(sheet([['工程名称：综合楼安装'],header,row('01','配电箱'),row('02','电力电缆'),row('03','轴流通风机'),row('04','水表'),row('05','声光报警器'),row('06','网络交换机'),row('07','水喷淋钢管')]));
  assert.deepEqual(result.materials.map(x=>x.source.profession),['强电','强电','暖通','给排水','火灾报警','智能化','消防水']);
  assert.ok(result.materials.every(x=>x.source.professionBasis==='material-name'));
  assert.ok(result.materials.every(x=>x.issueCodes.includes('source-inferred')));
});
test('explicit section discipline wins over item names and generic shared names remain unresolved',()=>{
  const known=parse(sheet([['工程名称：综合楼安装'],header,['','','智能化'],row('01','配电箱')]));
  assert.equal(known.materials[0].source.profession,'智能化');
  assert.equal(known.materials[0].source.professionBasis,'section');
  const generic=parse(sheet([['工程名称：综合楼安装'],header,row('01','配管'),row('02','碳钢阀门'),row('03','抗震支架')]));
  assert.ok(generic.materials.every(x=>!x.source.profession));
});
test('gas fire suppression is kept distinct from fire water',()=>{
  const result=parse(sheet([['工程名称：综合楼安装'],header,['','','气体灭火系统'],row('01','选择阀')]));
  assert.equal(result.materials[0].source.profession,'气体灭火');
});
test('paragraph notes on section labels do not override its leading discipline',()=>{
  const result=parse(sheet([['工程名称：一号楼电气'],header,['','','电气（配电箱含消防电源、火灾报警、智能照明模块）'],row()]));
  assert.equal(result.materials[0].source.profession,'强电');
});
test('numeric codes explicitly require display-format review rather than inventing leading zeros',()=>{
  const result=parse(sheet([['工程名称：一号楼给排水'],header,row(123)]));
  assert.equal(result.materials[0].code,'123');
  assert.ok(result.materials[0].issueCodes.includes('code-display-unverified'));
});
test('unrecognized nonempty lines are audited and reported',()=>{
  const result=parse(sheet([header,['备注补充','',null,'这里可能是续行内容']]));
  assert.ok(codes(result).includes('row-unrecognized'));
  assert.equal(result.sheets[0].audit[1].kind,'unrecognized');
});
test('malformed snapshots fail instead of silently returning a partial import',()=>{
  assert.throws(()=>parseWorkbook({name:'错表',sheets:[{name:'页',startRow:1,startColumn:1,rowCount:2,columnCount:1,values:[['x']]}]}),/不完整|范围/);
});
test('spaced totals in the first column are audited as totals',()=>{
  const result=parse(sheet([header,row(),['合    计','','','','','',999,999]]));
  assert.equal(result.materials.length,1);
  assert.equal(result.sheets[0].audit[2].kind,'total');
  assert.equal(codes(result).includes('row-unrecognized'),false);
});
test('adjacent feature-only continuation rows retain all segments and require review',()=>{
  const result=parse(sheet([header,row('001','设备','首段'),['','','',' 中段 '],['','','','尾段'],row('002','设备','另一条')]));
  assert.equal(result.materials.length,2);
  assert.equal(result.materials[0].feature,'首段\n 中段 \n尾段');
  assert.deepEqual(result.materials[0].featureParts,[{row:2,text:'首段'},{row:3,text:' 中段 '},{row:4,text:'尾段'}]);
  assert.deepEqual(result.materials[0].source.rows,[2,3,4]);
  assert.ok(result.materials[0].issueCodes.includes('feature-continuation'));
  assert.equal(result.materials[1].feature,'另一条');
  assert.equal(result.sheets[0].audit[2].kind,'continuation');
});
test('feature-only text separated by a section cannot attach to a previous material',()=>{
  const result=parse(sheet([header,row(),['','','新分部'],['','','','孤立特征']]));
  assert.equal(result.materials[0].feature,' DN50\n含接头 ');
  assert.ok(codes(result).includes('row-unrecognized'));
});
test('pagination titles reset source even when the title occupies a mapped payload column',()=>{
  const noSequence=['项目编码','项目名称','项目特征','单位','工程量'];
  const result=parse(sheet([['工程名称：一号楼强电'],noSequence,['001','配电箱','规格','台',1],
    ['工程名称：二号楼给排水'],noSequence,['002','水表','规格','个',2]]));
  assert.equal(result.materials.length,2);
  assert.deepEqual(result.materials.map(x=>[x.source.engineering,x.source.profession]),[['一号楼强电','强电'],['二号楼给排水','给排水']]);
  const reordered=parse(sheet([['工程名称：一号楼强电'],['工程量','项目名称','单位','项目特征','项目编码'],[1,'配电箱','台','','01'],
    ['工程名称：二号楼给排水','标段：甲','','','第 1 页 共 2 页'],[2,'水表','个','','02']]));
  assert.equal(reordered.materials.length,2);
  assert.equal(reordered.materials[1].source.engineering,'二号楼给排水');
});
test('a name-only row is exposed as an ambiguous section or incomplete material instead of silently skipped',()=>{
  const result=parse(sheet([['工程名称：一号楼给排水'],header,['','','水表']]));
  const issue=result.issues.find(x=>x.code==='section-ambiguous');
  assert.ok(issue);
  assert.equal(issue.row,3);
  assert.equal(issue.column,3);
});
test('a recognizable discipline word does not hide an otherwise incomplete material row',()=>{
  const result=parse(sheet([['工程名称：一号楼安装'],header,['','','电力电缆'],['','','轴流通风机']]));
  assert.deepEqual(result.issues.filter(x=>x.code==='section-ambiguous').map(x=>x.row),[3,4]);
});
test('engineering text inside an actual material never replaces heading context',()=>{
  const result=parse(sheet([['工程名称：一号楼给排水'],header,row('001','水表','工程名称：其他描述','个',1)]));
  assert.equal(result.materials.length,1);
  assert.equal(result.materials[0].source.engineering,'一号楼给排水');
});
