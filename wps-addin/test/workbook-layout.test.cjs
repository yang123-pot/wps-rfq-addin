const test=require('node:test'),assert=require('node:assert/strict');
const layout=require('../src/workbook-layout.js');

// 材料明细：短标题行＋10列公共列，模拟“分块宽度取首行”导致的截断/错位。
const DETAIL_HEADER=['序号','项目编码','项目名称','项目特征描述','单位','工程量','品牌','报价单价','金额','备注'];
test('区域字体字号及对齐受校验和边界约束',()=>{
 const spec=layout.build({columns:[{index:1}],fonts:[{row:1,column:1,name:'宋体',size:24}],
  alignments:[{row:1,column:1,horizontal:'center',vertical:'center'}]});
 assert.equal(spec.fonts[0].size,24);
 for(const font of [{row:1,column:1,size:-1},{row:1,column:1,name:''}])
  assert.equal(layout.validate({...spec,fonts:[font]}).ok,false);
 assert.equal(layout.validate({...spec,alignments:[{row:1,column:1,horizontal:'invalid'}]}).ok,false);
 assert.equal(layout.validate({...spec,alignments:[{row:1,column:2,horizontal:'left'}]},
  {rowCount:1,columnCount:1}).ok,false);
});

test('等宽矩阵：短标题行和被补齐的行不决定列宽，也不截断任何内容',()=>{
 const values=[['示例园区材料询价表'],
  ['项目名称：示例园区'],
  DETAIL_HEADER,
  ['1','FM-001','阀门','DN50','个','20','通达 / 海岳','','','']];
 const rows=layout.equalize(values,10);
 assert.equal(rows.length,4);
 rows.forEach(function(row,index){assert.equal(row.length,10,'第'+(index+1)+'行必须补齐到10列');});
 assert.deepEqual(rows[0],['示例园区材料询价表','','','','','','','','','']);
 assert.deepEqual(rows[2],DETAIL_HEADER,'表头不得被改写');
 assert.equal(rows[3][5],'20','工程量按文本原样保留');
 assert.equal(layout.equalize(values,12)[0].length,12,'允许更宽的矩阵');
 assert.deepEqual(layout.equalize(values)[0].length,10,'未指定时取最宽行');
 assert.throws(function(){layout.equalize(values,5);},/拒绝截断/,'列数小于内容必须拒绝而不是截断');
 assert.throws(function(){layout.equalize([['a'],'b'],2);},/二维数组/);
});

test('颜色转换按WPS的BGR整数，非法颜色直接拒绝',()=>{
 assert.equal(layout.toColor('#FFFFFF'),16777215);
 assert.equal(layout.toColor('#FF0000'),255,'红色在BGR低位');
 assert.equal(layout.toColor('#0000FF'),16711680,'蓝色在BGR高位');
 assert.throws(function(){layout.toColor('red');},/颜色/);
 assert.throws(function(){layout.toColor('#FFF');},/颜色/);
});

test('build补齐默认值并保持稳定结构，旧模型可无layout继续使用',()=>{
 const built=layout.build({columns:[{index:1,title:'序号'},{index:2,title:'名称',width:24,wrap:false}],
  headerRows:[3],freeze:{row:4,column:1},merges:[{row:1,column:1,columnSpan:10}],
  fills:[layout.inputFill(4,7,1,1)],
  validations:[layout.listValidation(4,8,5,1,'内部选项','$A$1:$A$5')],
  hyperlinks:[{row:4,column:2,address:'C:\\out\\水泵.xlsx',display:'水泵'}],
  print:{area:{row:1,column:1,rowSpan:20,columnSpan:10},repeatRow:3},metadata:{profile:'category-detail'}},
  {rowCount:20,columnCount:10});
 assert.equal(built.schemaVersion,1);
 assert.equal(built.fontSize,10);
 assert.equal(built.columns[0].width,18);assert.equal(built.columns[0].numberFormat,'@');
 assert.equal(built.columns[1].width,24);assert.equal(built.columns[1].wrap,false);
 assert.equal(built.merges[0].rowSpan,1,'合并区默认跨度补齐');
 assert.equal(built.validations[0].inCellDropdown,true);
 assert.equal(built.validations[0].allowBlank,true);
 assert.equal(built.metadata.profile,'category-detail');
 assert.deepEqual(layout.validate(built,{rowCount:20,columnCount:10}),{ok:true,errors:[]});
});

test('版式校验拒绝未知版本、缺列、非法颜色、错误链接与坏下拉区域',()=>{
 const base=layout.build({columns:[{index:1}],headerRows:[1]});
 assert.match(layout.validate({...base,schemaVersion:9}).errors.join('；'),/版本/);
 const noColumns={...base};delete noColumns.columns;
 assert.match(layout.validate(noColumns).errors.join('；'),/列定义/);
 assert.match(layout.validate({...base,fills:[{row:1,column:1,color:'#GGGGGG'}]}).errors.join('；'),/颜色/);
 assert.match(layout.validate({...base,hyperlinks:[{row:1,column:1,address:'  '}]}).errors.join('；'),/链接缺少地址/);
 assert.match(layout.validate({...base,validations:[{row:1,column:1,listSheet:'内部选项',listRange:'A1'}]}).errors.join('；'),/选项区域/);
 assert.match(layout.validate({...base,validations:[{row:1,column:1,listRange:'$A$1:$A$5'}]}).errors.join('；'),/选项表/);
 assert.match(layout.validate({...base,freeze:{row:-1,column:1}}).errors.join('；'),/冻结/);
 assert.throws(function(){layout.assertValid({...base,schemaVersion:9});},/版式不完整/);
});

test('bounds校验拦住超出工作表范围的合并/填充/下拉，避免短标题行导致越界',()=>{
 const layoutSpec=layout.build({columns:Array.from({length:10},function(_,index){return {index:index+1};}),
  merges:[{row:1,column:1,columnSpan:10}],fills:[layout.inputFill(2,7,1,1)]});
 assert.equal(layout.validate(layoutSpec,{rowCount:4,columnCount:10}).ok,true);
 const beyond=layout.build({columns:Array.from({length:10},function(_,index){return {index:index+1};}),
  merges:[{row:1,column:4,columnSpan:10}]});
 assert.match(layout.validate(beyond,{rowCount:4,columnCount:10}).errors.join('；'),/列范围/);
 const rowBeyond=layout.build({columns:[{index:1}],fills:[layout.inputFill(9,1,1,1)]});
 assert.match(layout.validate(rowBeyond,{rowCount:4,columnCount:1}).errors.join('；'),/行范围/);
});

test('便捷区域统一表头/填写区颜色，便于图02–07复用同一套版式',()=>{
 assert.deepEqual(layout.headerFill(3,10),{row:3,column:1,rowSpan:1,columnSpan:10,color:'#DCE6F1'});
 assert.equal(layout.inputFill(4,7,1,1).color,'#FFF7D6');
 assert.equal(layout.inputFill(4,7,1,1,layout.COLORS.accent).color,'#FDE9D9');
 const rule=layout.listValidation(4,8,1,4,'内部选项','$A$1:$A$5');
 assert.deepEqual(rule,{row:4,column:8,rowSpan:1,columnSpan:4,listSheet:'内部选项',listRange:'$A$1:$A$5',
  allowBlank:true,inCellDropdown:true,allowOtherInput:false});
 const typed=layout.listValidation(4,8,1,1,'内部选项','$A$1:$A$5',{allowOtherInput:true});
 assert.equal(typed.allowOtherInput,true,'最终分类允许输入下拉以外的值');
 assert.equal(typed.inCellDropdown,true,'保留下拉');
 assert.equal(layout.listValidation(4,8,1,1,'内部选项','$A$1:$A$5').allowOtherInput,false,
   '缺省仍只允许下拉内的值，避免影响其他下拉');
 assert.equal(layout.build({columns:[{index:1,width:8}],validations:[typed]},{rowCount:2,columnCount:1})
   .validations[0].allowOtherInput,true,'版式构建保留该标记');
});

// F1：工作表级隐藏（内部选项/内部绑定）由版式表达，缺省必须可见；非法取值在写盘前拒绝。
test('F1版式支持工作表隐藏标记，缺省可见且非法取值直接拒绝',()=>{
 const hidden=layout.build({columns:[{index:1,width:10}],hidden:true},{rowCount:2,columnCount:1});
 assert.equal(hidden.hidden,true);
 const visible=layout.build({columns:[{index:1,width:10}]},{rowCount:2,columnCount:1});
 assert.equal(visible.hidden,false,'缺省必须保持可见');
 assert.equal(layout.validate(hidden,{rowCount:2,columnCount:1}).ok,true);
 const broken=layout.validate(Object.assign({},hidden,{hidden:'yes'}));
 assert.equal(broken.ok,false);
 assert.match(broken.errors.join('；'),/隐藏/);
});
