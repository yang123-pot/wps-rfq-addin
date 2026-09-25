const test=require('node:test'),assert=require('node:assert/strict');
const plan=require('../src/split-plan.js'),inquiry=require('../src/inquiry-model.js');
function model(){
 return {inputKey:'ck1-split',coverageMode:'material-subsets',rowCount:3,sheets:[
  {sheetId:'sheet-a',kind:'inquiry',assignmentId:'a-1',categoryName:'水阀门',brand:'品牌甲',supplier:'供应商A',
   values:[['x'],['序号'],['1']],layout:{headerRow:2}},
  {sheetId:'sheet-b',kind:'inquiry',assignmentId:'a-2',categoryName:'水阀门',brand:'品牌乙',supplier:'供应商B',
   values:[['x'],['序号'],['1']],layout:{headerRow:2}},
  {sheetId:'sheet-x',kind:'internal',name:'内部追溯',values:[['x']]}]};
}
const generation={inputKey:'ck1-split',sheetIds:['sheet-a','sheet-b']};
test('one inquiry sheet becomes one file and internal sheets are never split out',()=>{
 const built=plan.build({model:model(),generation:generation,targetDirectory:'C:\\out\\项目询价'});
 assert.equal(built.files.length,2,'只按kind=inquiry取页，不按页名猜');
 assert.deepEqual(built.files.map(file=>file.name),['水阀门_供应商A.xlsx','水阀门_供应商B.xlsx']);
 assert.equal(built.files[0].target,'C:\\out\\项目询价\\水阀门_供应商A.xlsx');
 assert.equal(built.files[0].sheetId,'sheet-a');
 assert.equal(built.canPublish,true);
 assert.deepEqual(built.conflicts,[]);
 assert.equal(plan.build({model:model(),generation:generation,targetDirectory:'C:/out'}).files[0].target,'C:/out/水阀门_供应商A.xlsx');
});
test('duplicate names, missing generation and stale content are blocked before publishing',()=>{
 const duplicated=model();
 duplicated.sheets[1].sheetId='sheet-c';
 duplicated.sheets[1].supplier='供应商a';
 const clash=plan.build({model:duplicated,generation:generation,targetDirectory:'C:\\out'});
 assert.equal(clash.canPublish,false);
 assert.match(clash.conflicts.map(item=>item.message).join('；'),/文件名重复/);
 assert.match(plan.build({model:model(),targetDirectory:'C:\\out'}).conflicts.map(item=>item.code).join('；'),/no-generation/);
 assert.match(plan.build({model:model(),generation:{inputKey:'ck1-别的'},targetDirectory:'C:\\out'})
  .conflicts.map(item=>item.code).join('；'),/generation-stale/);
 assert.match(plan.build({model:model(),generation:generation,targetDirectory:''}).conflicts.map(item=>item.code).join('；'),/no-directory/);
});
test('illegal characters, reserved device names and long paths get concrete conflicts',()=>{
 const illegal=model();
 illegal.sheets[0].supplier='供应商/A:B';
 const cleaned=plan.build({model:illegal,generation:generation,targetDirectory:'C:\\out'});
 assert.equal(cleaned.files[0].name,'水阀门_供应商_A_B.xlsx');
 assert.match(cleaned.files[0].issues.map(item=>item.code).join('；'),/illegal-character/);
 assert.equal(cleaned.canPublish,true,'非法字符会被替换并提示，不做静默改名');
 const reserved=model();
 reserved.sheets[0].supplier='NUL';
 assert.match(plan.build({model:reserved,generation:generation,targetDirectory:'C:\\out'})
  .conflicts.map(item=>item.code).join('；'),/reserved-name/);
 const long=model();
 long.sheets[0].categoryName='类别'.repeat(80);
 assert.match(plan.build({model:long,generation:generation,targetDirectory:'C:\\'+'目录'.repeat(100)})
  .conflicts.map(item=>item.code).join('；'),/long-path/);
});
test('an existing target always blocks publishing instead of being overwritten',()=>{
 const built=plan.build({model:model(),generation:generation,targetDirectory:'C:\\out'});
 const checked=plan.checkTargets(built,['c:\\OUT\\水阀门_供应商a.xlsx']);
 assert.equal(checked.ok,false,'大小写不同也算同一个目标');
 assert.equal(checked.canPublish,false);
 assert.match(checked.conflicts.map(item=>item.message).join('；'),/绝不覆盖/);
 assert.equal(plan.checkTargets(built,['C:\\other\\别的.xlsx']).canPublish,true);
});
test('a sheet without a supplier is refused because the base name needs it',()=>{
 const missing=model();
 missing.sheets[0].supplier='';
 const built=plan.build({model:missing,generation:generation,targetDirectory:'C:\\out'});
 assert.match(built.conflicts.map(item=>item.code).join('；'),/empty-name/);
 assert.equal(built.canPublish,false);
 assert.equal(inquiry.INQUIRY,'inquiry');
});
