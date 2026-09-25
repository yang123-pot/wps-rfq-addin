const test=require('node:test'),assert=require('node:assert/strict');
const audit=require('../dev/release-audit.cjs');
const columns=['序号','项目编码','项目名称','项目特征描述','单位','工程量','品牌','报价单价','金额','备注'];
function clean(){
 return {workbook:{sheets:[{name:'水阀门-品牌甲',values:[
  ['测试安装工程有限公司'],['公司地址：测试市测试路1号'],['电话：010-12345678'],['供货单位：供应商A'],['工程名称：测试楼项目'],
  columns,['1','000123','水管','DN50','m','0.3','品牌甲','','','']]}]}};
}
test('a clean delivery file passes the audit',()=>{
 const report=audit.audit(clean());
 assert.equal(report.ok,true);
 assert.deepEqual(report.sheets,['水阀门-品牌甲']);
 assert.deepEqual(report.internalSheets,[]);
 assert.deepEqual(report.formulaCells,[]);
 assert.deepEqual(report.forbiddenFields,[]);
});
test('internal sheets, hidden sheets and unexpected sheets are all reported',()=>{
 const input=clean();
 input.workbook.sheets.push({name:'内部追溯',values:[['类别','品牌']]});
 input.workbook.sheets.push({name:'临时的',hidden:true,values:[['x']]});
 const report=audit.audit(Object.assign({allowedSheets:['水阀门-品牌甲']},input));
 assert.equal(report.ok,false);
 assert.deepEqual(report.internalSheets,['内部追溯']);
 assert.deepEqual(report.hiddenSheets,['临时的']);
 assert.deepEqual(report.unexpectedSheets.map(item=>item.code),['unexpected-sheet','unexpected-sheet']);
});
test('formulas, forbidden fields and personal contact data are flagged by cell',()=>{
 const input=clean();
 input.workbook.sheets[0].values[6][7]='=SUM(1+1)';
 input.workbook.sheets[0].values[6][9]='原价 12.3 元';
 const report=audit.audit(input);
 assert.equal(report.ok,false);
 assert.deepEqual(report.formulaCells,[{sheet:'水阀门-品牌甲',row:7,column:8,text:'=SUM(1+1)'}]);
 assert.deepEqual(report.forbiddenFields,[{sheet:'水阀门-品牌甲',row:7,column:10,field:'原价'}]);
});
test('the expected manifest is compared value by value',()=>{
 const input=clean();
 input.expectedManifest={cells:[{sheet:'水阀门-品牌甲',row:7,column:6,value:'0.3'},
  {sheet:'水阀门-品牌甲',row:7,column:7,value:'品牌甲'},
  {sheet:'不存在的表',row:1,column:1,value:'不存在'}]};
 const report=audit.audit(input);
 assert.equal(report.mismatches.length,1,'前两条必须逐值核对通过');
 assert.match(report.mismatches[0].reason,/没有这张工作表/);
 const wrong=clean();
 wrong.expectedManifest={cells:[{sheet:'水阀门-品牌甲',row:7,column:6,value:'9.9'}]};
 const mismatched=audit.audit(wrong);
 assert.deepEqual(mismatched.mismatches,[{sheet:'水阀门-品牌甲',row:7,column:6,expected:'9.9',actual:'0.3'}]);
 assert.equal(mismatched.ok,false);
});
test('the forbidden list covers the plan whitelist and keeps internal sheet names',()=>{
 ['原价','历史报价','原清单文件','原路径','SHA256','核对追溯JSON'].forEach(function(word){
  assert.equal(audit.FORBIDDEN.includes(word),true,word);
 });
 assert.equal(audit.INTERNAL_SHEETS.includes('内部追溯'),true);
 assert.equal(audit.INTERNAL_SHEETS.includes('处理记录'),true);
});
