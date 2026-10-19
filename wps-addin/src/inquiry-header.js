(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.RfqInquiryHeader=factory();
}(typeof window==='object'?window:globalThis,function(){
 'use strict';
 // 用户2026-10-19补充：前五行参考样式，四项必填保持；地址、传真、邮箱可选。
 // 版本号保持1：项目记录里的 header 字段由项目校验器要求 schemaVersion===1，升级字段不能升版本。
 var SCHEMA_VERSION=1,SUPPLIER_LABEL='供货单位',
  FIELDS=[{key:'projectName',label:'项目名称',prefix:'项目名称：',required:true},
   {key:'company',label:'单位名称',prefix:'单位名称：',required:true},
   {key:'contact',label:'材料经办人',prefix:'材料经办人：',required:true},
   {key:'phone',label:'联系方式',prefix:'联系方式：',required:true},
   {key:'address',label:'原公司地址',prefix:'公司地址：',required:false},
   {key:'fax',label:'传真',prefix:'传真：',required:false},
   {key:'email',label:'邮箱',prefix:'邮箱：',required:false}],
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
 // 固定五行；供货单位只取供应商，品牌仍在材料品牌列，空供应商不借用品牌填补。
 function block(input,suppliers){
  var value=normalize(input),groups=groupList(suppliers),lines=[];
  lines.push([value.company,'','','','','','','','询价']);
  lines.push(['公司地址：'+value.address,'','','','','','联系人：'+value.contact]);
  lines.push(['电话：'+value.phone,'','','传真：'+value.fax,'','','邮箱：'+value.email]);
  lines.push([SUPPLIER_LABEL+'：'+groups.map(function(group){return group.supplier;}).filter(function(value){return value;}).join(' / ')]);
  lines.push(['工程名称：'+value.projectName]);
  return {lines:lines,projectName:value.projectName,titleRow:1,infoRow:2,contactRow:3,addressRow:2,
   supplierFirstRow:4,supplierRowCount:1,groups:groups,headerRow:6};
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
