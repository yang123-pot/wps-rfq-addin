(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.RfqInquiryHeader=factory();
}(typeof window==='object'?window:globalThis,function(){
 'use strict';
 // 图06获批抬头：项目名称、单位名称、材料经办人、联系方式必填；原公司地址辅助可选。
 // 版本号保持1：项目记录里的 header 字段由项目校验器要求 schemaVersion===1，升级字段不能升版本。
 var SCHEMA_VERSION=1,SUPPLIER_LABEL='供应商信息',SUPPLIER_DASH=' — ',
  FIELDS=[{key:'projectName',label:'项目名称',prefix:'项目名称：',required:true},
   {key:'company',label:'单位名称',prefix:'单位名称：',required:true},
   {key:'contact',label:'材料经办人',prefix:'材料经办人：',required:true},
   {key:'phone',label:'联系方式',prefix:'联系方式：',required:true},
   {key:'address',label:'原公司地址',prefix:'原公司地址：',required:false}],
  REQUIRED=FIELDS.filter(function(field){return field.required;}).map(function(field){return field.key;});
 function text(value){return value==null?'':String(value).trim();}
 function fieldOf(key){return FIELDS.filter(function(field){return field.key===key;})[0];}
 function create(){var value={schemaVersion:SCHEMA_VERSION};FIELDS.forEach(function(field){value[field.key]='';});return value;}
 // 不填任何默认真实信息；联系方式只要求非空，不用手机号正则排除合法座机或分机。
 function validate(input){
  var errors=[];
  if(!input||typeof input!=='object'||Array.isArray(input))return {ok:false,errors:['询价抬头不是有效对象。']};
  if(input.schemaVersion!=null&&input.schemaVersion!==SCHEMA_VERSION)
   errors.push('询价抬头版本不支持：'+String(input.schemaVersion));
  REQUIRED.forEach(function(key){
   if(!text(input[key]))errors.push('缺少'+fieldOf(key).label+'。');
  });
  FIELDS.forEach(function(field){
   if(input[field.key]!=null&&typeof input[field.key]!=='string')errors.push(field.label+'必须是文本。');
   if(text(input[field.key]).length>200)errors.push(field.label+'过长，请精简。');
  });
  if(text(input.company)&&/^\d+$/.test(text(input.company)))errors.push('单位名称看起来只是数字，请确认。');
  return {ok:errors.length===0,errors:errors};
 }
 function assertValid(input){
  var check=validate(input);
  if(!check.ok)throw Error('询价抬头不完整：'+check.errors.join('；'));
  return input;
 }
 function normalize(input){
  var next={schemaVersion:SCHEMA_VERSION};
  FIELDS.forEach(function(field){next[field.key]=text(input&&input[field.key]);});
  return next;
 }
 // 询价对象自带的品牌/供应商组：图06供应商信息区逐组对应，不放进通用抬头字段。
 function groupList(suppliers){
  if(Array.isArray(suppliers))return suppliers.map(function(item){
   if(typeof item==='string')return {brand:'',supplier:text(item)};
   var value=item||{};
   return {brand:text(value.brand),supplier:text(value.supplier)};
  });
  if(suppliers==null||suppliers==='')return [];
  return [{brand:'',supplier:text(suppliers)}];
 }
 function supplierLine(group){
  if(group.brand&&group.supplier)return group.brand+SUPPLIER_DASH+group.supplier;
  return group.brand||group.supplier||'';
 }
 // 图06抬头块：标题行、空行、项目名称/单位名称行、材料经办人行、可选地址行、供应商信息区（每组一行）。
 // 返回具体行号供模型生成合并区、冻结、打印重复表头时使用。
 function block(input,suppliers){
  var value=normalize(input),groups=groupList(suppliers),lines=[];
  lines.push([value.projectName+'材料询价表']);
  lines.push(['']);
  lines.push([FIELDS[0].prefix+value.projectName,'','','','',FIELDS[1].prefix+value.company]);
  lines.push([FIELDS[2].prefix+value.contact,'','','','',FIELDS[3].prefix+value.phone]);
  var addressRow=null;
  if(value.address){addressRow=lines.length+1;lines.push([FIELDS[4].prefix+value.address]);}
  var supplierFirstRow=lines.length+1,supplierRowCount=Math.max(groups.length,1);
  if(groups.length){
   groups.forEach(function(group,position){lines.push([position===0?SUPPLIER_LABEL:'',supplierLine(group)]);});
  }else lines.push([SUPPLIER_LABEL,'']);
  return {lines:lines,projectName:value.projectName,titleRow:1,infoRow:3,contactRow:4,addressRow:addressRow,
   supplierFirstRow:supplierFirstRow,supplierRowCount:supplierRowCount,groups:groups,
   headerRow:lines.length+1};
 }
 // 兼容旧调用：只取抬头块的行内容。
 function rows(input,suppliers){return block(input,suppliers).lines;}
 function summary(input){
  var value=normalize(input),parts=[];
  FIELDS.forEach(function(field){
   if(field.required||value[field.key])parts.push(field.label+'：'+(value[field.key]||'（空）'));
  });
  return parts.join(' · ');
 }
 function same(left,right){return JSON.stringify(normalize(left))===JSON.stringify(normalize(right));}
 return {SCHEMA_VERSION:SCHEMA_VERSION,FIELDS:FIELDS,REQUIRED:REQUIRED.slice(),SUPPLIER_LABEL:SUPPLIER_LABEL,
  create:create,validate:validate,assertValid:assertValid,normalize:normalize,block:block,rows:rows,summary:summary,same:same};
}));
