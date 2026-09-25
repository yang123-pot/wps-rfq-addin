(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.RfqInquiryHeader=factory();
}(typeof window==='object'?window:globalThis,function(){
 'use strict';
 var SCHEMA_VERSION=1,
  FIELDS=[{key:'company',label:'公司名称'},{key:'address',label:'公司地址',prefix:'公司地址：'},
   {key:'phone',label:'联系方式',prefix:'电话：'},{key:'projectName',label:'工程名称',prefix:'工程名称：'},
   {key:'contact',label:'材料员',prefix:'材料员：'}],
  REQUIRED=['company','address','phone','projectName','contact'];
 function text(value){return value==null?'':String(value).trim();}
 function create(){var value={schemaVersion:SCHEMA_VERSION};FIELDS.forEach(function(field){value[field.key]='';});return value;}
 // 不填任何默认真实信息；联系方式只要求非空，不用手机号正则排除合法座机或分机。
 function validate(input){
  var errors=[];
  if(!input||typeof input!=='object'||Array.isArray(input))return {ok:false,errors:['询价抬头不是有效对象。']};
  if(input.schemaVersion!=null&&input.schemaVersion!==SCHEMA_VERSION)
   errors.push('询价抬头版本不支持：'+String(input.schemaVersion));
  REQUIRED.forEach(function(key){
   var field=FIELDS.filter(function(item){return item.key===key;})[0];
   if(!text(input[key]))errors.push('缺少'+field.label+'。');
  });
  FIELDS.forEach(function(field){
   if(input[field.key]!=null&&typeof input[field.key]!=='string')errors.push(field.label+'必须是文本。');
   if(text(input[field.key]).length>200)errors.push(field.label+'过长，请精简。');
  });
  if(text(input.company)&&/^\d+$/.test(text(input.company)))errors.push('公司名称看起来只是数字，请确认。');
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
 // 供应商来自本次拆分/询价对象，不放在通用抬头里；抬头行与本机既有材料分类文件保持一致。
 function rows(input,supplier){
  var value=normalize(input),out=[[value.company],[FIELDS[1].prefix+value.address],
   [FIELDS[2].prefix+value.phone],['供货单位：'+text(supplier)],[FIELDS[3].prefix+value.projectName]];
  if(value.contact)out.push(['材料员：'+value.contact]);
  return out;
 }
 function summary(input){
  var value=normalize(input);
  return FIELDS.map(function(field){return field.label+'：'+(value[field.key]||'（空）');}).join(' · ');
 }
 function same(left,right){return JSON.stringify(normalize(left))===JSON.stringify(normalize(right));}
 return {SCHEMA_VERSION:SCHEMA_VERSION,FIELDS:FIELDS,REQUIRED:REQUIRED,create:create,validate:validate,
  assertValid:assertValid,normalize:normalize,rows:rows,summary:summary,same:same};
}));
