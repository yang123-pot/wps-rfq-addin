const test=require('node:test'),assert=require('node:assert/strict');
const audit=require('../dev/release-audit.cjs');

const COLUMNS=['序号','项目编码','项目名称','项目特征描述','单位','工程量','品牌','报价单价','金额','备注'];
const TITLE='示例园区 水泵询价表';
const CONTACT='联系方式：010-12345678';
const SHA='a'.repeat(64);

function clone(value){return JSON.parse(JSON.stringify(value));}
function setCell(sheet,rowIndex,columnIndex,value){
 while(sheet.values.length<=rowIndex)sheet.values.push([]);
 const row=sheet.values[rowIndex];
 while(row.length<=columnIndex)row.push(null);
 row[columnIndex]=value;
}
// 图07形态的供应商件：A1标题合并；A3:F5抬头/供应商区；第6行10列表头；第7行起物料。
function supplierSheet(){
 return {
  name:'水泵_青源',kind:'inquiry',
  merges:['A1:J1','A3:E3','F3:J3','A4:E4','F4:J4','B5:J5'],
  values:[
   [TITLE],
   [],
   ['项目名称：示例园区',null,null,null,null,'单位名称：示例建设公司'],
   ['材料经办人：测试员',null,null,null,null,CONTACT],
   ['供应商信息','青源 — 华川设备'],
   COLUMNS.slice(),
   ['1','SB-001','水泵','DN50','台','2','青源','','',''],
   ['2','SB-002','水泵','DN65','台','3','青源','','','']
  ]
 };
}
function supplierWorkbook(){return {sheets:[supplierSheet()]};}
function supplierManifest(){
 return {complete:true,profile:'supplier',sheets:[{
  name:'水泵_青源',kind:'inquiry',visibility:'visible',columns:10,
  title:{cell:'A1',value:TITLE,merge:'A1:J1'},
  merges:['A3:E3','F3:J3','A4:E4','F4:J4','B5:J5'],
  fields:[
   {cell:'A3',label:'项目名称',value:'项目名称：示例园区'},
   {cell:'F3',label:'单位名称',value:'单位名称：示例建设公司'},
   {cell:'A4',label:'材料经办人',value:'材料经办人：测试员'},
   {cell:'F4',label:'联系方式',value:CONTACT,contact:true}
  ],
  supplierRegion:[{cell:'A5',value:'供应商信息'},{cell:'B5',value:'青源 — 华川设备'}],
  material:{headerRow:6,firstDataRow:7,header:COLUMNS.slice(),rows:[
   ['1','SB-001','水泵','DN50','台','2','青源','','',''],
   ['2','SB-002','水泵','DN65','台','3','青源','','','']
  ]}
 }]};
}
function cellText(report,list,cell){return list.filter(function(item){return item.cell===cell;});}

test('F5：完整清单中项目编码列的12位编码及合并编码不误报电话',()=>{
 for(const code of ['030402011015','030402011015；030402011017']){
  const workbook=supplierWorkbook(),manifest=supplierManifest();
  setCell(workbook.sheets[0],6,1,code);manifest.sheets[0].material.rows[0][1]=code;
  const report=audit.audit({workbook,expectedManifest:manifest});
  assert.equal(report.ok,true,JSON.stringify(report.personalLeaks));
  assert.deepEqual(report.personalLeaks,[]);
 }
});
test('F5：编码例外不放过不同源值、改列名、备注复制及真正电话',()=>{
 for(const scenario of ['changed-value','wrong-header','remark-copy','phone-in-code']){
  const workbook=supplierWorkbook(),manifest=supplierManifest(),code='030402011015';
  setCell(workbook.sheets[0],6,1,code);manifest.sheets[0].material.rows[0][1]=code;
  let cell='B7';
  if(scenario==='changed-value')setCell(workbook.sheets[0],6,1,'030402011017');
  if(scenario==='wrong-header'){
   setCell(workbook.sheets[0],5,1,'电话');manifest.sheets[0].material.header[1]='电话';
  }
  if(scenario==='remark-copy'){
   cell='J7';setCell(workbook.sheets[0],6,9,code);manifest.sheets[0].material.rows[0][9]=code;
  }
  if(scenario==='phone-in-code'){
   setCell(workbook.sheets[0],6,1,'010-12345678');manifest.sheets[0].material.rows[0][1]='010-12345678';
  }
  const report=audit.audit({workbook,expectedManifest:manifest});
  assert.equal(report.ok,false,scenario);
  assert.ok(report.personalLeaks.some(x=>x.cell===cell),scenario);
 }
});

test('supplier file passes with declared rise-header contact and long code',()=>{
 const workbook=supplierWorkbook();
 setCell(workbook.sheets[0],6,1,'00012345678901234567');
 const manifest=supplierManifest();
 manifest.sheets[0].material.rows[0][1]='00012345678901234567';
 const report=audit.audit({profile:'supplier',workbook:workbook,expectedManifest:manifest});
 assert.equal(report.ok,true);
 assert.equal(report.valueChecked,true);
 assert.equal(report.verdict,'value-verified');
 assert.deepEqual(report.mismatches,[]);
 assert.deepEqual(report.extraCells,[]);
 assert.deepEqual(report.missingCells,[]);
 assert.deepEqual(report.personalLeaks,[],'长编码与抬头指定联系方式不得当成未授权个人信息');
 assert.deepEqual(report.formulaCells,[]);
 assert.deepEqual(report.internalSheets,[]);
 assert.deepEqual(report.hiddenColumns,[]);
});

test('extra hidden column with same phone, path, SHA or original price is rejected by cell',()=>{
 const workbook=supplierWorkbook();
 const sheet=workbook.sheets[0];
 sheet.hiddenColumns=[11];
 setCell(sheet,6,10,'010-12345678');
 setCell(sheet,7,10,'Z:\\机密\\原清单.json');
 setCell(sheet,8,10,SHA);
 setCell(sheet,9,10,'原价 12.3 元');
 const report=audit.audit({profile:'supplier',workbook:workbook,expectedManifest:supplierManifest()});
 assert.equal(report.ok,false);
 assert.deepEqual(report.hiddenColumns,[{sheet:'水泵_青源',column:11}]);
 assert.equal(cellText(report,report.personalLeaks,'K7').length,1,'同一个电话出现在非抬头位置必须拒绝');
 assert.equal(cellText(report,report.pathLeaks,'K8').length,1);
 assert.equal(cellText(report,report.shaLeaks,'K9').length,1);
 assert.equal(cellText(report,report.forbiddenFields,'K10').length,1);
 ['K7','K8','K9','K10'].forEach(function(cell){
  assert.equal(cellText(report,report.extraCells,cell).length,1,'额外列内容必须报出 '+cell);
 });
});

test('an extra unexpected value and a missing expected value both fail',()=>{
 const extra=supplierWorkbook();
 setCell(extra.sheets[0],6,9,'未预期的备注');
 const extraReport=audit.audit({profile:'supplier',workbook:extra,expectedManifest:supplierManifest()});
 assert.equal(extraReport.ok,false);
 assert.equal(cellText(extraReport,extraReport.extraCells,'J7').length,1);

 const missing=supplierWorkbook();
 setCell(missing.sheets[0],6,5,'');
 const missingReport=audit.audit({profile:'supplier',workbook:missing,expectedManifest:supplierManifest()});
 assert.equal(missingReport.ok,false);
 const hit=cellText(missingReport,missingReport.missingCells,'F7');
 assert.equal(hit.length,1);
 assert.equal(hit[0].expected,'2');
});

test('formulas, internal sheets and hidden sheets all fail while text that starts with = is not a formula',()=>{
 const workbook=supplierWorkbook();
 setCell(workbook.sheets[0],6,7,'=SUM(1+1)');
 workbook.sheets.push({name:'内部追溯',kind:'internal',values:[['类别','品牌']]});
 workbook.sheets.push({name:'临时隐藏页',hidden:true,values:[['x']]});
 const report=audit.audit({profile:'supplier',workbook:workbook,expectedManifest:supplierManifest()});
 assert.equal(report.ok,false);
 assert.equal(cellText(report,report.formulaCells,'H7').length,1);
 assert.ok(report.internalSheets.indexOf('内部追溯')>=0);
 assert.ok(report.hiddenSheets.indexOf('临时隐藏页')>=0);
 assert.ok(report.unexpectedSheets.some(function(item){return item.sheet==='内部追溯';}));

 const textFormula=supplierWorkbook();
 setCell(textFormula.sheets[0],6,9,{text:'=1+1',kind:'text'});
 const manifest=supplierManifest();
 manifest.sheets[0].material.rows[0][9]={value:'=1+1',type:'text'};
 const textReport=audit.audit({profile:'supplier',workbook:textFormula,expectedManifest:manifest});
 assert.deepEqual(textReport.formulaCells,[],'文本=…不得误报为公式');
 assert.deepEqual(textReport.typeIssues,[]);
 assert.equal(textReport.ok,true);

 const realFormula=supplierWorkbook();
 setCell(realFormula.sheets[0],6,9,'=1+1');
 const formulaManifest=supplierManifest();
 formulaManifest.sheets[0].material.rows[0][9]='=1+1';
 const formulaReport=audit.audit({profile:'supplier',workbook:realFormula,expectedManifest:formulaManifest});
 assert.equal(formulaReport.ok,false);
 assert.equal(cellText(formulaReport,formulaReport.formulaCells,'J7').length,1);
});

test('internal-total allows only declared internal sheets while supplier rejects every internal page',()=>{
 const workbook=supplierWorkbook();
 workbook.sheets.push({name:'处理记录',kind:'internal',values:[['类别','品牌','方式'],['水泵','青源','合成一份']]});
 const internalManifest=supplierManifest();
 internalManifest.sheets.push({name:'处理记录',kind:'internal',visibility:'visible',columns:3,
  material:{headerRow:1,firstDataRow:2,header:['类别','品牌','方式'],rows:[['水泵','青源','合成一份']]}});
 internalManifest.profile='internal-total';
 const allowed=audit.audit({profile:'internal-total',workbook:clone(workbook),expectedManifest:internalManifest});
 assert.equal(allowed.ok,true,'内部总簿允许清单声明的内部页');
 assert.ok(allowed.internalSheets.indexOf('处理记录')>=0);
 assert.deepEqual(allowed.internalSheetViolations,[]);

 const asSupplier=audit.audit({profile:'supplier',workbook:clone(workbook),expectedManifest:supplierManifest()});
 assert.equal(asSupplier.ok,false,'供应商件任何内部页都必须失败');
 assert.ok(asSupplier.internalSheetViolations.indexOf('处理记录')>=0);

 const undeclared=audit.audit({profile:'internal-total',workbook:clone(workbook),expectedManifest:supplierManifest()});
 assert.equal(undeclared.ok,false,'内部总簿未声明的内部页必须失败');
 assert.ok(undeclared.internalSheetViolations.indexOf('处理记录')>=0);
});

test('per-profile hidden trace column and material column count are checked',()=>{
 const workbook=supplierWorkbook();
 workbook.sheets[0].hiddenColumns=[11];
 setCell(workbook.sheets[0],5,10,'额外列');
 const report=audit.audit({profile:'supplier',workbook:workbook,expectedManifest:supplierManifest()});
 assert.equal(report.ok,false);
 assert.equal(cellText(report,report.extraCells,'K6').length,1,'第11列不属于物料10列');
 assert.ok(report.layoutIssues.some(function(item){return item.code==='column-beyond-declared';}));
});

test('material rows follow the declared header position instead of treating the rise-header as material',()=>{
 const manifest=supplierManifest();
 manifest.sheets[0].material.headerRow=1;
 manifest.sheets[0].material.firstDataRow=2;
 const report=audit.audit({profile:'supplier',workbook:supplierWorkbook(),expectedManifest:manifest});
 assert.equal(report.ok,false);
 assert.ok(report.mismatches.some(function(item){return item.cell==='A1';}),'错把抬头当物料行会立即报值不符');
 assert.ok(report.missingCells.some(function(item){return item.cell==='A2';}));
});

test('comments, hyperlinks and external relationships are scanned',()=>{
 const workbook=supplierWorkbook();
 workbook.sheets[0].comments=[{cell:'A3'}];
 workbook.sheets[0].hyperlinks=[{cell:'B7',target:'file:///F:/机密/来源.xlsx'}];
 const report=audit.audit({profile:'supplier',workbook:workbook,expectedManifest:supplierManifest()});
 assert.equal(report.ok,false);
 assert.equal(report.commentCells.length,1);
 assert.equal(cellText(report,report.hyperlinkCells,'B7').length,1);
 assert.equal(cellText(report,report.externalLinks,'B7').length,1);
});

test('a complete manifest is required before reporting value-by-value pass',()=>{
 const noContact=supplierWorkbook();
 setCell(noContact.sheets[0],3,5,'联系方式：示例联系方式');
 const report=audit.audit({profile:'supplier',workbook:noContact});
 assert.equal(report.ok,false);
 assert.equal(report.valueChecked,false);
 assert.equal(report.verdict,'scan-only');
 assert.ok(report.notes.some(function(note){return note.indexOf('仅报告扫描结果')>=0;}));
 assert.deepEqual(report.sheets,['水泵_青源']);

 const withPhone=audit.audit({profile:'supplier',workbook:supplierWorkbook()});
 assert.equal(withPhone.valueChecked,false);
 assert.notEqual(withPhone.verdict,'value-verified');
 assert.ok(withPhone.personalLeaks.some(function(item){return item.cell==='F4';}),'没有完整清单时不得豁免联系方式');
});

test('the forbidden list and internal sheet names stay explicit',()=>{
 ['原价','历史报价','原清单文件','原路径','SHA256','核对追溯JSON'].forEach(function(word){
  assert.equal(audit.FORBIDDEN.includes(word),true,word);
 });
 ['内部追溯','处理记录','来源明细','清单'].forEach(function(name){
  assert.equal(audit.INTERNAL_SHEETS.includes(name),true,name);
 });
 assert.deepEqual(audit.PROFILES.slice().sort(),['internal-total','supplier']);
});
