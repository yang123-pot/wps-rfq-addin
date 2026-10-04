const test=require('node:test'),assert=require('node:assert/strict');
const sample=require('./fixtures/workflow-v3-sample.cjs');
const collection=require('../src/collection.js');
const model=require('../src/classification-review-model.js');
const memory=require('../src/category-memory.js');
const layout=require('../src/workbook-layout.js');
const host=require('../src/classification-review-host.js');

function built(){
  const col=sample.buildCollection();
  const preview=collection.preview(col,true);
  return {preview:preview,result:model.build(preview.groups,{library:sample.library,memory:sample.createMemory(),projectId:'p-sample01'})};
}

test('自动分类只给建议：8行中7行有建议、1行冲突，全部尚未人工确认',()=>{
  const {preview,result}=built();
  assert.equal(preview.groups.length,8,'合并后应8行');
  assert.equal(result.counts.rows,8);
  assert.equal(result.counts.suggested,6,'水泵/阀门/风机共6行唯一建议');
  assert.equal(result.counts.skip,1,'钢索1行建议无需询价');
  assert.equal(result.counts.conflict,1,'充电桩配电箱1行冲突');
  assert.equal(result.counts.none,0);
  assert.equal(result.counts.pending,8,'全部仍是待人工确认');
  assert.equal(result.rows.every(row=>row.reviewNote===''),true,'生成阶段不写审核备注');
  const summary=model.summary(result);
  assert.equal(summary.text,'8 行结果已写入成果表');
  assert.equal(summary.detail,'7 行有建议 · 1 行需重点核对','与图02侧栏统计一致');
  assert.equal(summary.confirmed,0,'尚未人工确认');
});

test('唯一可靠建议预填最终分类，冲突行留空并标为异常',()=>{
  const {result}=built();
  const byKey={};
  result.rows.forEach(row=>{byKey[sample.keyOf(row.name,row.feature,row.unit)]=row;});
  assert.equal(byKey[sample.keyOf('水泵','DN50','台')].finalCategoryName,'水泵','唯一建议预填');
  assert.equal(byKey[sample.keyOf('钢索','规格C','m')].finalCategoryName,'无需询价','无需询价可预填');
  assert.equal(byKey[sample.keyOf('钢索','规格C','m')].matchState,'无需询价');
  const conflict=byKey[sample.keyOf('充电桩配电箱','充电桩配套','台')];
  assert.equal(conflict.matchState,'分类冲突');
  assert.equal(conflict.finalCategoryId,'','冲突必须留空交给用户决定');
  assert.equal(conflict.abnormal,true,'冲突行必须突出显示');
  assert.match(conflict.matchBasis,/多个类别/);
  assert.match(byKey[sample.keyOf('水泵','DN50','台')].matchBasis,/完全匹配/);
});

test('成果表按图03列序输出9列，规格保存完整特征，编码与来源只进内部绑定',()=>{
  const {result}=built();
  const sheet=model.mainSheet(result,{title:'示例园区_分类审核成果.xlsx'});
  assert.deepEqual(model.COLUMNS,['序号','项目名称','规格','单位','工程量','自动建议','匹配情况','最终分类','审核备注']);
  assert.deepEqual(sheet.values[2].slice(0,9),model.COLUMNS,'第3行前9列是公开表头');
  assert.deepEqual(sheet.values[2].slice(9),['',''],'表头右侧只留辅助列位');
  assert.equal(sheet.values[0][0],'示例园区_分类审核成果.xlsx','标题行与图02一致');
  assert.match(sheet.values[1][0],/自动匹配仅供参考/);
  assert.equal(sheet.values.length,model.HEADER_ROW+result.rows.length,'标题2行＋表头1行＋全部有效行');
  assert.deepEqual(model.publicRow(result.rows[0]),['1','水泵','DN50','台','2','水泵','匹配成功','水泵','']);
  assert.equal(sheet.values[3][2],'DN50','规格列保存完整项目特征描述');
  assert.equal(sheet.values[3][4],'2','工程量按文本写入，保留精度');
  assert.equal(sheet.values[3].length,11,'公开9列＋序号/行标识辅助列');
  assert.equal(sheet.values[3][10],result.rows[0].rowId,'K列保存稳定rowId');
  assert.equal(model.COLUMNS.includes(result.rows[0].code),false,'主表不得出现技术字段');
  const binding=model.bindingSheet(result);
  assert.deepEqual(binding.values[0],['行标识','序号','项目编码','项目名称','项目特征描述','单位','工程量','来源边界','来源标识','库版本']);
  assert.equal(binding.values[1][2],result.rows[0].code,'编码只在内部绑定表');
  assert.equal(binding.values.length,result.rows.length+1);
});

test('其他项目已确认的记忆与规则同类时仍预填成果表，真实类别冲突继续留空',()=>{
  const preview=collection.preview(sample.buildCollection(),true);
  const decisions=[
    ['水泵','DN50','台','pump','水泵'],['水泵','DN65','台','pump','水泵'],
    ['阀门','DN50','个','valve','阀门'],['阀门','DN65','个','valve','阀门'],
    ['送风机','规格A','台','fan','风机'],['排风机','规格B','台','fan','风机'],
    ['充电桩配电箱','充电桩配套','台','ev-charger','汽车充电桩'],['钢索','规格C','m','no-inquiry','无需询价']
  ];
  let state=sample.createMemory();
  decisions.forEach(([name,feature,unit,categoryId,categoryName])=>{
    const group=preview.groups.find(row=>row.name===name&&row.feature===feature&&row.unit===unit);
    state=memory.learn(state,{categoryId,categoryName,rowId:group.id,revision:1,
      confirmedAt:'2026-10-04T05:32:42.737Z'},
      {item:{name,feature,unit},sourceProjectId:'p-review-owner',scope:'global'});
  });
  const before=JSON.stringify(state);
  const result=model.build(preview.groups,{library:sample.library,memory:state,projectId:'p-review-other'});
  decisions.forEach(([name,feature,,categoryId,categoryName])=>{
    const row=result.rows.find(item=>item.name===name&&item.feature===feature);
    if(name==='充电桩配电箱'){
      assert.equal(row.finalCategoryId,'','不同类别仍是冲突，不能采用历史确认覆盖另一规则');
      assert.equal(row.autoCategoryId,null);
      assert.equal(row.abnormal,true);
      assert.equal(row.matchState,'分类冲突');
    }else{
      assert.equal(row.autoCategoryId,categoryId,'同类别的两种依据应产生可靠建议');
      assert.equal(row.finalCategoryName,categoryName,'最终分类预填唯一类别');
      assert.equal(model.publicRow(row)[5],categoryName,'公开自动建议不能丢为待核对');
      assert.equal(model.publicRow(row)[7],categoryName,'公开最终分类必须与建议相符');
    }
  });
  assert.equal(result.counts.suggested,6);
  assert.equal(result.counts.skip,1,'无需询价不能误记为普通匹配成功');
  assert.equal(result.counts.conflict,1);
  assert.equal(result.counts.pending,8,'预填不代表人工确认');
  assert.equal(JSON.stringify(state),before,'生成不能改变任何记忆来源或学习状态');
});

test('多条规则只命中同一类别时预填最终分类，保留真实规则依据',()=>{
  const preview=collection.preview(sample.buildCollection(),true);
  const library=JSON.parse(JSON.stringify(sample.library));
  library.rules.push({id:'fixture-pump-feature',categoryId:'pump',state:'active',basis:'水泵规格核对',
    match:[{field:'name',any:['水泵']},{field:'feature',any:['DN50']}]});
  const result=model.build(preview.groups,{library,memory:sample.createMemory(),projectId:'p-multi-rules'});
  const row=result.rows.find(item=>item.name==='水泵'&&item.feature==='DN50');
  assert.equal(row.autoCategoryId,'pump');
  assert.equal(row.finalCategoryName,'水泵');
  assert.equal(row.matchState,'匹配成功');
  assert.equal(row.abnormal,false);
  assert.equal(result.counts.pending,8);
});

test('版式落地：表头浅色、最终分类浅黄带区域下拉、异常行橙色、隐藏辅助列、冻结与打印',()=>{
  const {result}=built();
  const sheet=model.mainSheet(result,{title:'示例园区_分类审核成果.xlsx'});
  const spec=sheet.layout;
  assert.equal(layout.validate(spec,{rowCount:sheet.values.length,columnCount:11}).ok,true);
  assert.equal(spec.columns[10].hidden,true,'行标识列必须隐藏');
  assert.equal(spec.columns[9].hidden,false);
  assert.equal(spec.freeze.row,model.FIRST_ROW,'冻结表头');
  assert.equal(spec.print.repeatRow,model.HEADER_ROW,'打印重复表头');
  assert.deepEqual(spec.merges.map(item=>item.columnSpan),[9,9]);
  const header=spec.fills.filter(item=>item.row===model.HEADER_ROW&&item.color===layout.COLORS.header);
  assert.equal(header.length,1,'表头浅色填充');
  const input=spec.fills.filter(item=>item.column===8&&item.color===layout.COLORS.input);
  assert.equal(input.length,1,'最终分类列浅黄可编辑');
  assert.equal(input[0].rowSpan,result.rows.length);
  const abnormal=spec.fills.filter(item=>item.color===layout.COLORS.accent);
  assert.equal(abnormal.length,result.counts.conflict,'异常行橙色');
  assert.equal(abnormal[0].columnSpan,9);
  assert.equal(spec.validations.length,1,'最终分类列挂区域下拉');
  assert.equal(spec.validations[0].column,8);
  assert.equal(spec.validations[0].listSheet,model.OPTIONS_SHEET);
  assert.equal(spec.validations[0].listRange,'$B$2:$B$'+String(result.categories.length+1));
  const options=model.optionsSheet(result);
  assert.deepEqual(options.values[0],['类别编号','类别名称']);
  assert.equal(options.values.length,result.categories.length+1,'下拉选项来自内部表');
});

test('生成成果表不学习、不确认：传入记忆也不写回、阶段仍是待确认',()=>{
  const col=sample.buildCollection(),preview=collection.preview(col,true),state=sample.createMemory();
  const before=JSON.stringify(state);
  const result=model.build(preview.groups,{library:sample.library,memory:state,projectId:'p-sample01'});
  assert.equal(JSON.stringify(state),before,'生成建议不得写入习惯记忆');
  assert.equal(result.counts.pending,result.counts.rows,'全部仍待人工确认');
  assert.equal(memory.summary(state).active,0);
  const again=model.build(preview.groups,{library:sample.library,memory:state,projectId:'p-sample01'});
  assert.deepEqual(again.counts,result.counts,'重复生成结果一致');
  assert.deepEqual(model.expectedRows(again),model.expectedRows(result),'固定字段快照可重复比对');
  assert.throws(()=>model.build(preview.groups,{}),/分类库/);
  assert.throws(()=>model.build(null,{library:sample.library}),/已确认的合并结果/);
  assert.throws(()=>model.build(preview.groups,{library:{version:'x',categories:[],rules:[]}}),/分类库不可用/);
});

// R5：用等宽矩阵模拟读表结果，和host.readSheet给的记录同形（rowId/固定字段/最终分类/审核备注）。
function readResult(result,change){
  const byName={};result.categories.forEach(category=>{byName[category.name]=category.id;});
  const read={rows:result.rows.map((row,index)=>{
    const finalCategoryName=row.finalCategoryName||'';
    return {rowId:row.rowId,row:model.FIRST_ROW+index,index:String(row.index),name:row.name,feature:row.feature,
      unit:row.unit,quantity:row.quantity,autoCategoryName:model.autoLabel(row),autoCategoryId:row.autoCategoryId,
      finalCategoryName:finalCategoryName,reviewNote:'',finalCategoryId:byName[finalCategoryName]||''};
  }),issues:[]};
  // 行序按来源排列（图02/03的样例行序只是示意），断言一律按材料定位，不按物理行号。
  read.row=(name,feature)=>read.rows.filter(item=>item.name===name&&(!feature||item.feature===feature))[0];
  if(change)change(read);
  return read;
}
function pick(rows,name,feature){
  return rows.filter(item=>item.name===name&&(!feature||item.feature===feature))[0];
}

test('整表校验：图03的充电桩配电箱改选汽车充电桩后通过，钢索保持无需询价，匹配情况按最终分类重算',()=>{
  const {result}=built();
  const read=readResult(result,state=>{
    const row=state.row('充电桩配电箱');
    row.finalCategoryName='汽车充电桩';row.finalCategoryId='ev-charger';row.reviewNote='充电桩配套';
  });
  const checked=model.validateRead(read,{categories:result.categories});
  assert.equal(checked.ok,true);
  assert.deepEqual(checked.errors,[]);
  const conflict=pick(checked.rows,'充电桩配电箱');
  assert.equal(conflict.categoryId,'ev-charger','用户表内改的类别必须读回稳定类别编号');
  assert.equal(conflict.categoryName,'汽车充电桩');
  assert.equal(conflict.note,'充电桩配套','审核备注只作为备注，不参与类别选择');
  assert.equal(conflict.match,'存在差异','自动建议冲突、由用户决定的行属于存在差异');
  const steel=pick(checked.rows,'钢索');
  assert.equal(steel.categoryId,'no-inquiry');
  assert.equal(steel.skip,true,'钢索保留无需询价');
  assert.equal(steel.match,'一致');
  assert.equal(checked.counts.consistent,7);
  assert.equal(checked.counts.different,1);
  assert.equal(checked.counts.noInquiry,1);
  assert.equal(checked.counts.notes,1);
  assert.equal(checked.summary,'8 行 · 已填 8 · 与建议不同 1 · 无需询价 1');
});

test('整表校验：空分类、未知分类、读回问题都定位到单元格，整表不完整不放行',()=>{
  const {result}=built();
  const emptyRead=readResult(result,state=>{
    const conflict=state.row('充电桩配电箱');
    conflict.finalCategoryName='汽车充电桩';conflict.finalCategoryId='ev-charger';
    const row=state.row('水泵','DN50');
    row.finalCategoryName='';row.finalCategoryId='';
  });
  const emptyTarget=emptyRead.row('水泵','DN50');
  const empty=model.validateRead(emptyRead,{categories:result.categories});
  assert.equal(empty.ok,false);
  assert.equal(empty.errors.length,1);
  assert.deepEqual([empty.errors[0].code,empty.errors[0].row,empty.errors[0].column],
    ['category-empty',emptyTarget.row,8]);
  assert.match(empty.errors[0].message,/“最终分类”为空/);
  assert.equal(empty.counts.empty,1);
  const unknownRead=readResult(result,state=>{
    const conflict=state.row('充电桩配电箱');
    conflict.finalCategoryName='汽车充电桩';conflict.finalCategoryId='ev-charger';
    const row=state.row('阀门','DN50');
    row.finalCategoryName='临时类别';row.finalCategoryId='';
  });
  const unknown=model.validateRead(unknownRead,{categories:result.categories});
  assert.equal(unknown.ok,false);
  assert.equal(unknown.errors[0].code,'category-unknown');
  assert.equal(unknown.errors[0].title,'最终分类无效');
  assert.equal(unknown.errors[0].row,unknownRead.row('阀门','DN50').row);
  assert.equal(unknown.errors[0].column,8);
  assert.equal(unknown.counts.unknown,1);
  const broken=model.validateRead(readResult(result,state=>{
    const conflict=state.row('充电桩配电箱');
    conflict.finalCategoryName='汽车充电桩';conflict.finalCategoryId='ev-charger';
    state.issues.push({row:5,column:5,code:'field-changed',message:'第5行“工程量”已改：原“3”现“4”'});
    state.issues.push({row:null,column:null,code:'row-missing',message:'成果表缺少材料行：钢索 / 规格C'});
  }),{categories:result.categories});
  assert.equal(broken.ok,false);
  assert.equal(broken.errors.length,2);
  assert.equal(broken.errors[0].title,'固定字段被改动');
  assert.equal(broken.errors[0].row,5);
  assert.equal(broken.errors[0].column,5);
  assert.equal(broken.errors[1].title,'材料行缺失');
  assert.equal(broken.errors[1].row,null);
  assert.equal(model.MATCH.consistent,'一致');
  assert.equal(model.matchLabel('pump','pump'),'一致');
  assert.equal(model.matchLabel(null,'pump'),'存在差异');
  assert.equal(model.matchLabel('pump',''),'存在差异');
});

test('保存草稿：未填完也能存，但行标识或固定字段被破坏时拒绝，草稿只保留rowId/类别/备注',()=>{
  const {result}=built();
  const partial=readResult(result,state=>{
    ['充电桩配电箱','钢索'].forEach(name=>{
      const row=state.row(name);row.finalCategoryName='';row.finalCategoryId='';
    });
  });
  const saved=model.draft(partial,{inputKey:'ck2-0123456789abcdef',projectId:'p-sample01',
    savedAt:'2026-09-26T11:00:00.000Z',binding:{path:'C:\\out\\示例园区_分类审核成果.xlsx',sheet:model.SHEET}});
  assert.equal(saved.ok,true);
  assert.deepEqual(saved.draft.counts,{rows:8,filled:6,empty:2,notes:0});
  assert.equal(saved.draft.state,'draft');
  assert.equal(saved.draft.inputKey,'ck2-0123456789abcdef');
  assert.equal(saved.draft.savedAt,'2026-09-26T11:00:00.000Z');
  assert.deepEqual(Object.keys(saved.draft.rows[0]),
    ['rowId','index','name','feature','unit','quantity','categoryId','categoryName','note'],'草稿只存行标识与用户可编辑的两列');
  const refused=model.draft(readResult(result,state=>{state.issues.push({row:null,column:null,code:'row-missing',
    message:'成果表缺少材料行：水泵 / DN50'});}),{});
  assert.equal(refused.ok,false);
  assert.equal(refused.draft,null);
  assert.equal(refused.errors[0].code,'row-missing');
});

test('整表确认快照按rowId保存整表类别与备注并可判重；改确认只列出被改行',()=>{
  const {result}=built();
  const read=readResult(result,state=>{
    const row=state.row('充电桩配电箱');
    row.finalCategoryName='汽车充电桩';row.finalCategoryId='ev-charger';row.reviewNote='充电桩配套';
  });
  const checked=model.validateRead(read,{categories:result.categories});
  const conflict=pick(checked.rows,'充电桩配电箱'),steel=pick(checked.rows,'钢索');
  const binding={path:'C:\\out\\示例园区_分类审核成果.xlsx',sheet:model.SHEET,headerRow:3,firstRow:4,lastRow:11,
    rowIdColumn:11,sha256:'b'.repeat(64)};
  const first=model.confirmation(checked.rows,{projectId:'p-sample01',inputKey:'ck2-0123456789abcdef',
    libraryVersion:result.libraryVersion,binding:binding,confirmedAt:'2026-09-26T10:00:00.000Z',revision:1});
  assert.equal(first.revision,1);
  assert.equal(first.confirmedAt,'2026-09-26T10:00:00.000Z');
  assert.equal(first.inputKey,'ck2-0123456789abcdef');
  assert.equal(first.sheet.path,binding.path);
  assert.equal(first.sheet.rowIdColumn,11);
  assert.equal(first.rows.length,8);
  const firstConflict=pick(first.rows,'充电桩配电箱'),firstSteel=pick(first.rows,'钢索');
  assert.equal(firstConflict.categoryId,'ev-charger');
  assert.equal(firstConflict.categoryName,'汽车充电桩');
  assert.equal(firstConflict.note,'充电桩配套');
  assert.equal(firstConflict.match,'存在差异');
  assert.equal(firstSteel.skip,true);
  assert.equal(first.counts.consistent,7);
  const reversed=model.confirmation(checked.rows.slice().reverse(),{projectId:'p-sample01',inputKey:'ck2-0123456789abcdef'});
  assert.equal(model.sameRows(first,reversed),true,'表内排序不算内容变化');
  assert.deepEqual(model.changedRows(first,reversed),[]);
  const moved=checked.rows.map(row=>row.rowId===steel.rowId?
    Object.assign({},row,{categoryId:'ev-charger',categoryName:'汽车充电桩',skip:false,match:'存在差异'}):row);
  const edited=model.confirmation(moved,{projectId:'p-sample01',inputKey:'ck2-0123456789abcdef'});
  assert.equal(model.sameRows(first,edited),false);
  assert.deepEqual(model.changedRows(first,edited),[{rowId:steel.rowId,
    from:{categoryId:'no-inquiry',note:''},to:{categoryId:'ev-charger',note:''}}],'改确认只撤销被改行的来源');
  assert.equal(conflict.categoryId,'ev-charger');
  assert.throws(()=>model.confirmation([],{}),/至少一行/);
});

test('成果表绑定有效性：缺表要先生成，旧inputKey必须重新生成',()=>{
  assert.equal(model.bindingState(null,'ck2-0123456789abcdef').code,'missing');
  assert.match(model.bindingState(null,'ck2-0123456789abcdef').message,/请先在“自动分类”阶段生成/);
  assert.equal(model.bindingState({inputKey:'ck2-0123456789abcdef'},'ck2-0123456789abcdef').ok,true);
  const stale=model.bindingState({inputKey:'ck2-0000000000000000'},'ck2-0123456789abcdef');
  assert.equal(stale.ok,false);
  assert.equal(stale.code,'stale');
  assert.match(stale.message,/重新生成/);
  assert.equal(model.bindingState({},'ck2-0123456789abcdef').ok,true,'无键的旧绑定仍按现行内容校验');
});

// R12-C：把项目里已保存的审核快照（确认或草稿）写成新的成果副本，用户的人工决定不因文件未保存而丢失。
test('R12-C：按已保存快照重建成果副本，类别/备注取快照、编码等固定字段取绑定，重建后可再整表读回',()=>{
  const {result}=built();
  const receipt={target:'C:\\out\\示例园区_分类审核成果.xlsx',sha256:'a'.repeat(64)};
  const binding=host.bindingFor(receipt,result,{inputKey:'ck2-0123456789abcdef'});
  const read=readResult(result,state=>{
    const row=state.row('充电桩配电箱');
    row.finalCategoryName='汽车充电桩';row.finalCategoryId='ev-charger';row.reviewNote='充电桩配套';
  });
  const snapshot=model.confirmation(model.validateRead(read,{categories:result.categories}).rows,
    {projectId:'p-sample01',inputKey:'ck2-0123456789abcdef',binding:binding,
     confirmedAt:'2026-09-27T10:01:15.871Z',revision:1});
  const restored=model.fromSnapshot(snapshot,binding,{});
  assert.equal(restored.rows.length,8,'重建副本必须保留整表行数');
  const conflict=restored.rows.filter(row=>row.finalCategoryId==='ev-charger')[0];
  assert.equal(conflict.finalCategoryName,'汽车充电桩','类别取已保存快照');
  assert.equal(conflict.reviewNote,'充电桩配套','备注取已保存快照');
  const field=binding.fields.filter(item=>item.rowId===conflict.rowId)[0];
  assert.equal(conflict.code,field.code,'项目编码等固定字段来自绑定，不丢内部数据');
  assert.equal(conflict.autoCategoryId,field.autoCategoryId,'自动建议作为固定字段保留');
  const steel=restored.rows.filter(row=>row.finalCategoryId==='no-inquiry')[0];
  assert.equal(steel.skipped===undefined,true);
  assert.equal(steel.finalCategoryName,'无需询价','无需询价按快照保留');
  const sheet=model.mainSheet(restored,{title:'示例园区_分类审核成果_恢复副本.xlsx'});
  assert.deepEqual(sheet.values[model.HEADER_ROW-1],model.COLUMNS.concat(['','']),'第3行是公开表头');
  const rowIndex=restored.rows.indexOf(conflict),line=sheet.values[model.FIRST_ROW+rowIndex-1];
  assert.equal(line[7],'汽车充电桩');
  assert.equal(line[8],'充电桩配套');
  assert.equal(line[10],conflict.rowId,'K列仍写随行rowId');
  const rebuilt=host.bindingFor({target:'C:\\out\\恢复副本.xlsx',sha256:'b'.repeat(64)},restored,{inputKey:'ck2-0123456789abcdef'});
  const reader=(row,column)=>(sheet.values[row-1]||[])[column-1];
  const back=host.readSheet(reader,rebuilt);
  assert.deepEqual(back.issues,[],'重建的成果副本必须能被同一套读回校验通过');
  assert.equal(host.compareSnapshot(back,snapshot).matches,true,'重建副本业务内容与快照一致');
  assert.throws(()=>model.fromSnapshot({rows:[]},binding,{}),/快照/);
});
