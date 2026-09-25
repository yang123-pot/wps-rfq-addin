(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.RfqDecimal=factory();
}(typeof window==='object'?window:globalThis,function(){
 'use strict';
 function isQuantity(value){return typeof value==='string'&&/^\d+(?:\.\d+)?$/.test(value);}
 function normalize(value){
  var parts=String(value).split('.'),integer=parts[0].replace(/^0+(?=\d)/,''),
   fraction=(parts[1]||'').replace(/0+$/,'');
  return integer+(fraction?'.'+fraction:'');
 }
 // 十进制文本相加，不使用浮点累加，保留前导零之外的精度。
 function add(left,right){
  if(typeof left!=='string'||typeof right!=='string'||!isQuantity(left)||!isQuantity(right))
   throw Error('工程量必须是十进制文本，不能相加减。');
  var a=left,b=right;
  var leftParts=a.split('.'),rightParts=b.split('.'),
   scale=Math.max((leftParts[1]||'').length,(rightParts[1]||'').length);
  var x=leftParts[0]+(leftParts[1]||'').padEnd(scale,'0'),y=rightParts[0]+(rightParts[1]||'').padEnd(scale,'0');
  var size=Math.max(x.length,y.length),carry=0,sum='';
  x=x.padStart(size,'0');y=y.padStart(size,'0');
  for(var index=size-1;index>=0;index--){
   var digit=Number(x[index])+Number(y[index])+carry;
   sum=String(digit%10)+sum;carry=Math.floor(digit/10);
  }
  if(carry)sum=String(carry)+sum;
  if(scale)sum=sum.slice(0,-scale)+'.'+sum.slice(-scale);
  return normalize(sum);
 }
 function sum(list){return (list||[]).reduce(function(total,value){return add(total,value);},'0');}
 function compare(left,right){
  var a=normalize(String(left)),b=normalize(String(right));
  if(a===b)return 0;
  var leftParts=a.split('.'),rightParts=b.split('.');
  var leftInteger=leftParts[0].replace(/^0+(?=\d)/,''),rightInteger=rightParts[0].replace(/^0+(?=\d)/,'');
  if(leftInteger.length!==rightInteger.length)return leftInteger.length<rightInteger.length?-1:1;
  if(leftInteger!==rightInteger)return leftInteger<rightInteger?-1:1;
  var scale=Math.max((leftParts[1]||'').length,(rightParts[1]||'').length);
  var leftFraction=(leftParts[1]||'').padEnd(scale,'0'),rightFraction=(rightParts[1]||'').padEnd(scale,'0');
  if(leftFraction===rightFraction)return 0;
  return leftFraction<rightFraction?-1:1;
 }
 return {isQuantity:isQuantity,normalize:normalize,add:add,sum:sum,compare:compare};
}));
