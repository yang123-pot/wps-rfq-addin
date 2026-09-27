const test=require('node:test'),assert=require('node:assert/strict');
const sample=require('./fixtures/workflow-v3-sample.cjs');
const collection=require('../src/collection.js');
const model=require('../src/classification-review-model.js');
const host=require('../src/classification-review-host.js');

function built(){
  const col=sample.buildCollection(),preview=collection.preview(col,true);
  return model.build(preview.groups,{library:sample.library,memory:sample.createMemory(),projectId:'p-sample01'});
}
function bound(){
  const result=built();
  const receipt={target:'C:\\out\\示例园区_分类审核成果.xlsx',sha256:'a'.repeat(64)};
  return {result:result,binding:host.bindingFor(receipt,result,{inputKey:'ck2-0123456789abcdef'})};
}
// 用等宽矩阵模拟读表：read(row,column)按1基行列取单元格文本。
function readerOf(values,change){
  const grid=values.map(row=>row.slice());
  if(change)change(grid);
  return (row,column)=>(grid[row-1]||[])[column-1];
}

test('建议文件名安全，绑定含路径/SHA/表位/rowId/固定字段/库版本/类别',()=>{
  assert.equal(host.suggestedName('示例园区'),'示例园区_分类审核成果.xlsx');
  const cleaned=host.suggestedName('A/B:C*?');
  assert.doesNotMatch(cleaned,/[/\\:*?"<>|]/,'路径非法字符必须清洗');
  assert.match(cleaned,/分类审核成果\.xlsx$/);
  assert.equal(host.suggestedName('   '),'未命名项目_分类审核成果.xlsx');
  const {result,binding}=bound();
  assert.equal(binding.schemaVersion,1);
  assert.equal(binding.sheet,'分类审核成果');
  assert.equal(binding.headerRow,3);assert.equal(binding.firstRow,4);assert.equal(binding.rowIdColumn,11);
  assert.equal(binding.lastRow,11,'8行数据到第11行');
  assert.equal(binding.rowIds.length,8);
  assert.equal(binding.fields[0].rowId,result.rows[0].rowId);
  assert.equal(binding.fields[0].code,result.rows[0].code,'固定字段快照保留项目编码');
  assert.equal(binding.libraryVersion,sample.library.version);
  assert.equal(binding.categories.some(item=>item.name==='汽车充电桩'),true);
  assert.equal(binding.categories.some(item=>item.id==='no-inquiry'),true,'下拉必须包含无需询价');
  assert.equal(binding.inputKey,'ck2-0123456789abcdef');
  assert.throws(()=>host.bindingFor({target:'C:\\out\\x.xlsx',sha256:'zz'},result),/回执无效/);
});

test('读回按稳定rowId核对：整表排序后仍逐行对上，未保存编辑直接可见',()=>{
  const {result,binding}=bound();
  const sheet=model.mainSheet(result,{title:'示例园区_分类审核成果.xlsx'});
  const happy=host.readSheet(readerOf(sheet.values),binding);
  assert.deepEqual(happy.issues,[],'未改动时不得报问题');
  assert.equal(happy.rows.length,8);
  assert.equal(happy.rows[0].finalCategoryName,'水泵');
  assert.equal(happy.rows[0].finalCategoryId,'pump','名称必须解析回稳定类别编号');
  const sorted=host.readSheet(readerOf(sheet.values,grid=>{
   const headerBlock=grid.slice(0,3),data=grid.slice(3).reverse();
   data.forEach((row,index)=>grid[3+index]=row);
   grid.splice(0,3,...headerBlock);
  }),binding);
  assert.deepEqual(sorted.issues,[],'表内排序不得误判为内容变化');
  assert.equal(sorted.rows[0].rowId,happy.rows[7].rowId,'仍按rowId对应');
  const edited=host.readSheet(readerOf(sheet.values,grid=>{grid[5][7]='汽车充电桩';grid[5][8]='现场确认';}),binding);
  assert.deepEqual(edited.issues,[]);
  const row=edited.rows.filter(item=>item.rowId===happy.rows[2].rowId)[0];
  assert.equal(row.finalCategoryName,'汽车充电桩','用户表内修改必须能读回');
  assert.equal(row.finalCategoryId,'ev-charger');
  assert.equal(row.reviewNote,'现场确认');
});

test('读回拦住固定字段改动、缺行、重复行与未知行，并给出单元格位置',()=>{
  const {result,binding}=bound();
  const sheet=model.mainSheet(result,{title:'示例园区_分类审核成果.xlsx'});
  const changed=host.readSheet(readerOf(sheet.values,grid=>{grid[3][4]='99';}),binding);
  assert.equal(changed.issues.length,1);
  assert.equal(changed.issues[0].code,'field-changed');
  assert.equal(changed.issues[0].row,4);assert.equal(changed.issues[0].column,5,'工程量在第5列');
  assert.match(changed.issues[0].message,/工程量/);
  const missingRow=host.readSheet(readerOf(sheet.values,grid=>{grid.splice(10,1);}),binding);
  assert.equal(missingRow.issues.some(item=>item.code==='row-id-missing'),true,'删行后该行必须报缺标识');
  assert.equal(missingRow.issues.some(item=>item.code==='row-missing'),true,'绑定里的材料行不得静默丢失');
  const duplicate=host.readSheet(readerOf(sheet.values,grid=>{grid[4][10]=grid[3][10];}),binding);
  assert.equal(duplicate.issues.some(item=>item.code==='row-id-duplicate'),true,'复制行必须报重复标识');
  const unknown=host.readSheet(readerOf(sheet.values,grid=>{grid[3][10]='row-foreign';}),binding);
  assert.equal(unknown.issues.some(item=>item.code==='row-id-unknown'),true,'外来行标识必须报未知');
});

test('读表复用已打开簿，只关闭自开簿，并恢复宏安全值与活动工作簿',()=>{
  const {result,binding}=bound();
  const sheet=model.mainSheet(result,{title:'示例园区_分类审核成果.xlsx'});
  function fixture(alreadyOpen){
   const calls={opened:0,closed:0};
   const previous={FullName:'C:\\用户.xlsx',Activate(){app._active=this;}};
   const book={FullName:binding.path,Close(save){assert.equal(save,false);calls.closed++;},
    Worksheets:{Item(name){
     if(name!=='分类审核成果')return undefined;
     return {Cells:{Item(row,column){return {Value2:(sheet.values[row-1]||[])[column-1]};}}};}},
    Activate(){app._active=this;}};
   const app={AutomationSecurity:1,_active:previous,get ActiveWorkbook(){return app._active;},
    Workbooks:{Count:alreadyOpen?0:1,Item(){return previous;},
     Open(path,links,readonly){calls.opened++;assert.equal(app.AutomationSecurity,3,'打开前必须临时禁宏');
      assert.equal(links,0);assert.equal(readonly,true);assert.equal(path,binding.path);app._active=book;return book;}}};
   if(alreadyOpen){app.Workbooks.Count=1;app.Workbooks.Item=function(index){return index===1?book:previous;};app._active=book;}
   return {app,calls};
  }
  const opened=fixture(false),read=host.readBack(opened.app,binding);
  assert.equal(read.rows.length,8);assert.equal(opened.calls.opened,1);assert.equal(opened.calls.closed,1);
  assert.equal(opened.app.AutomationSecurity,1,'宏安全值必须恢复');
  assert.equal(opened.app.ActiveWorkbook,opened.app.Workbooks.Item(1),'活动工作簿必须恢复');
  const reused=fixture(true),second=host.readBack(reused.app,binding);
  assert.equal(second.rows.length,8);
  assert.equal(reused.calls.opened,0,'同路径已打开时必须复用最新修改');
  assert.equal(reused.calls.closed,0,'不得关闭用户自己打开的簿');
  assert.throws(()=>host.readBack({AutomationSecurity:null,Workbooks:{Count:0},ActiveWorkbook:null},binding),/宏安全设置/);
  assert.throws(()=>host.readBack(reused.app,Object.assign({},binding,{sheet:'不存在'})),/找不到工作表/);
  assert.throws(()=>host.readSheet(()=>'',Object.assign({},binding,{fields:[]})),/固定字段快照/);
});

test('打开成果表供用户编辑：临时禁宏、置前且不关闭，安全值恢复',()=>{
  const {binding}=bound();
  const calls={opened:0,activated:0};
  const book={FullName:binding.path,Activate(){calls.activated++;app._active=this;}};
  const app={AutomationSecurity:1,_active:{FullName:'C:\\用户.xlsx',Activate(){}},get ActiveWorkbook(){return app._active;},
   Workbooks:{Count:1,Item(){return {FullName:'C:\\其他.xlsx'};},
    Open(path,links,readonly){calls.opened++;assert.equal(path,binding.path);
     assert.equal(readonly,false,'编辑用必须可写打开');assert.equal(app.AutomationSecurity,3,'打开前临时禁宏');
     app._active=book;return book;}}};
  assert.deepEqual(host.openForEditing(app,binding.path),{path:binding.path,opened:true});
  assert.equal(calls.opened,1);assert.equal(calls.activated,1,'必须置前供用户直接编辑');
  assert.equal(app._active,book,'成果表保持打开并置前');
  assert.equal(app.AutomationSecurity,1,'宏安全值必须恢复');
  assert.throws(()=>host.openForEditing(app,'relative.xlsx'),/路径无效/);
  assert.throws(()=>host.openForEditing({AutomationSecurity:null,Workbooks:{Count:0}},binding.path),/宏安全设置/);
});

// R5：整表读回要能按自动建议重算“匹配情况”，因此绑定必须记下生成时的自动建议并把它当固定字段核对。
test('绑定保存自动建议：冲突行记“待核对”，用户改动“自动建议”列会定位到第6列',()=>{
  const {result,binding}=bound();
  assert.equal(binding.fields[0].autoCategoryName,'水泵');
  assert.equal(binding.fields[0].autoCategoryId,'pump');
  const conflict=binding.fields.filter(field=>field.autoCategoryName==='待核对')[0];
  assert.ok(conflict,'冲突行必须记录“待核对”');
  assert.equal(conflict.autoCategoryId,null);
  const sheet=model.mainSheet(result,{title:'示例园区_分类审核成果.xlsx'});
  assert.deepEqual(host.readSheet(readerOf(sheet.values),binding).issues,[]);
  const changed=host.readSheet(readerOf(sheet.values,grid=>{grid[3][5]='阀门';}),binding);
  assert.equal(changed.issues.length,1);
  assert.deepEqual([changed.issues[0].code,changed.issues[0].row,changed.issues[0].column],['field-changed',4,6]);
  assert.match(changed.issues[0].message,/自动建议/);
});

test('定位问题单元格并原位刷新“匹配情况”：只写需要改的单元格，且不保存文件',()=>{
  const {result,binding}=bound();
  const sheet=model.mainSheet(result,{title:'示例园区_分类审核成果.xlsx'});
  const writes=[],selects=[];
  function cell(row,column){
   return {get Value2(){return (sheet.values[row-1]||[])[column-1];},
    set Value2(value){writes.push([row,column,value]);},Select(){selects.push([row,column]);}};
  }
  const sheetStub={Cells:{Item:cell},Activate(){}};
  const book={FullName:binding.path,saves:0,Worksheets:{Item(name){return name===binding.sheet?sheetStub:undefined;}},
   Activate(){},Save(){book.saves++;},Close(){}};
  const app={AutomationSecurity:1,ActiveWorkbook:{FullName:'C:\\用户.xlsx',Activate(){}},
   Workbooks:{Count:1,Item(){return book;}}};
  const located=host.locate(app,binding,{row:10,column:8});
  assert.deepEqual(located,{path:binding.path,sheet:binding.sheet,row:10,column:8});
  assert.deepEqual(selects,[[10,8]],'必须选中具体问题单元格供用户修改');
  assert.equal(app.AutomationSecurity,1,'宏安全值必须恢复');
  const unchanged=host.refreshMatchColumn(app,binding,[{row:4,label:'匹配成功'}]);
  assert.equal(unchanged.updated,0);
  assert.deepEqual(writes,[]);
  const refreshed=host.refreshMatchColumn(app,binding,[{row:4,label:'一致'},{row:10,label:'存在差异'}]);
  assert.equal(refreshed.updated,2);
  assert.deepEqual(writes,[[4,7,'一致'],[10,7,'存在差异']],'匹配情况固定在公开第7列');
  assert.equal(book.saves,0,'只刷新显示，不保存文件，磁盘SHA与绑定仍可核');
  assert.throws(()=>host.locate(app,binding,{row:0,column:8}),/行号/);
  assert.throws(()=>host.refreshMatchColumn(app,Object.assign({},binding,{sheet:'不存在'}),[{row:4,label:'一致'}]),
   /找不到工作表/);
});

// R12-C：把磁盘/打开簿的读回结果与项目确认快照按rowId比较业务内容。
// SHA只能证明物理字节，业务内容必须逐行对照；磁盘空分类与快照“汽车充电桩”绝不能被当成“内容已一致”。
function conflictRowId(result){
  return result.rows.filter(function(row){return row.autoCategoryId==null;})[0].rowId;
}
function withDecision(read,rowId,changes){
  return {rows:read.rows.map(function(row){
    return row.rowId===rowId?Object.assign({},row,changes):row;
  }),issues:(read.issues||[]).slice()};
}
function snapshotFrom(result,binding,decisions){
  const edited=withDecision(host.readSheet(readerOf(
    model.mainSheet(result,{title:'示例园区_分类审核成果.xlsx'}).values),binding),decisions.rowId,decisions.changes);
  const checked=model.validateRead(edited,{categories:binding.categories});
  return model.confirmation(checked.rows,{projectId:'p-sample01',inputKey:binding.inputKey,binding:binding,
    confirmedAt:'2026-09-27T10:01:15.871Z',revision:1});
}

test('R12-C比较：磁盘空分类与确认快照不一致必须报出（H11空/快照汽车充电桩）',()=>{
  const {result,binding}=bound();
  const rowId=conflictRowId(result);
  const disk=host.readSheet(readerOf(model.mainSheet(result,{title:'示例园区_分类审核成果.xlsx'}).values),binding);
  assert.equal(disk.rows.filter(function(row){return row.rowId===rowId;})[0].finalCategoryName,'',
    '磁盘成果表该行最终分类为空（表内编辑未保存）');
  const snapshot=snapshotFrom(result,binding,{rowId:rowId,
    changes:{finalCategoryName:'汽车充电桩',finalCategoryId:'ev-charger',reviewNote:'充电桩配套'}});
  const diff=host.compareSnapshot(disk,snapshot);
  assert.equal(diff.matches,false,'磁盘为空、快照为汽车充电桩时必须判为业务不一致');
  const category=diff.differences.filter(function(item){return item.rowId===rowId&&item.field==='categoryId';})[0];
  assert.ok(category,'必须给出最终分类差异');
  assert.equal(category.expected,'汽车充电桩');
  assert.equal(category.actual,'');
  assert.match(category.message,/最终分类/);
  assert.match(category.message,/汽车充电桩/);
  const note=diff.differences.filter(function(item){return item.rowId===rowId&&item.field==='note';})[0];
  assert.ok(note,'备注差异也要报出');
});

test('R12-C比较：按rowId比较，排序/筛选不影响；内容一致才算一致',()=>{
  const {result,binding}=bound();
  const rowId=conflictRowId(result);
  const snapshot=snapshotFrom(result,binding,{rowId:rowId,
    changes:{finalCategoryName:'汽车充电桩',finalCategoryId:'ev-charger',reviewNote:'充电桩配套'}});
  const edited=withDecision(host.readSheet(readerOf(
    model.mainSheet(result,{title:'示例园区_分类审核成果.xlsx'}).values),binding),rowId,
    {finalCategoryName:'汽车充电桩',finalCategoryId:'ev-charger',reviewNote:'充电桩配套'});
  const same=host.compareSnapshot(edited,snapshot);
  assert.equal(same.matches,true,'内容一致时必须判为一致');
  assert.deepEqual(same.differences,[]);
  const reversed=host.compareSnapshot({rows:edited.rows.slice().reverse(),issues:[]},snapshot);
  assert.equal(reversed.matches,true,'读回顺序（排序/筛选）不得改变结论');
  assert.equal(host.compareSnapshot({rows:edited.rows.map(function(row){
    return Object.assign({},row,{reviewNote:row.reviewNote});}),issues:[]},snapshot).matches,true);
});

test('R12-C比较：固定字段、备注、缺行与多余行都按rowId给出差异',()=>{
  const {result,binding}=bound();
  const rowId=conflictRowId(result);
  const snapshot=snapshotFrom(result,binding,{rowId:rowId,
    changes:{finalCategoryName:'汽车充电桩',finalCategoryId:'ev-charger',reviewNote:'充电桩配套'}});
  const base=withDecision(host.readSheet(readerOf(
    model.mainSheet(result,{title:'示例园区_分类审核成果.xlsx'}).values),binding),rowId,
    {finalCategoryName:'汽车充电桩',finalCategoryId:'ev-charger',reviewNote:'充电桩配套'});
  const quantityChanged=host.compareSnapshot({rows:base.rows.map(function(row,index){
    return index?row:Object.assign({},row,{quantity:'ZZ'});}),issues:[]},snapshot);
  assert.equal(quantityChanged.matches,false);
  assert.equal(quantityChanged.differences[0].field,'quantity');
  assert.equal(quantityChanged.differences[0].code,'field-changed');
  const noteChanged=host.compareSnapshot({rows:base.rows.map(function(row){
    return row.rowId===rowId?Object.assign({},row,{reviewNote:'改了备注'}):row;}),issues:[]},snapshot);
  assert.equal(noteChanged.differences.filter(function(item){return item.field==='note';}).length,1);
  const missing=host.compareSnapshot({rows:base.rows.filter(function(row){return row.rowId!==rowId;}),issues:[]},snapshot);
  assert.equal(missing.differences.filter(function(item){return item.code==='row-missing';}).length,1);
  const extra=host.compareSnapshot({rows:base.rows.concat([{rowId:'row-foreign',name:'外来行',finalCategoryName:'水泵',
    finalCategoryId:'pump',reviewNote:''}]),issues:[]},snapshot);
  assert.equal(extra.differences.filter(function(item){return item.code==='row-extra';}).length,1);
});
