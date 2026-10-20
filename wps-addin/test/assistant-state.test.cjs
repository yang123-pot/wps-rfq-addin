const test=require('node:test');const assert=require('node:assert/strict');
let api;try{api=require('../src/assistant-state.js');}catch(_){api={};}
test('导入必须先看预览，之后才可确认合并',()=>{
 assert.equal(typeof api.create,'function');const s=api.create();
 assert.equal(s.view().action,'import');s.set({files:[{name:'A.xlsx'}],previewAvailable:true});
 assert.equal(s.view().action,'previewConfirm');assert.equal(s.view().mergeVisible,false);
 s.set({previewReviewed:true});assert.equal(s.view().action,'mergeConfirm');assert.equal(s.view().mergeVisible,true);
});
test('打开失败和未完成持久保存不能提前切到下一步',async()=>{
 assert.equal(typeof api.create,'function');const s=api.create({mergeConfirmed:true,reviewGenerated:true});
 s.register('reviewOpen',async()=>{throw Error('打开失败');});
 await assert.rejects(s.run('reviewOpen'),/打开失败/);assert.equal(s.view().step,2);
 s.set({reviewOpened:true});assert.equal(s.view().step,3);
 s.set({reviewConfirmed:true,categoriesReady:true,summaryReady:true});assert.equal(s.view().action,'continueBrands');
 s.set({brandsOpened:true});assert.equal(s.view().step,5);
});
test('动作可等待且双击只执行一次，过程中不跳到下一项',async()=>{
 assert.equal(typeof api.create,'function');const s=api.create();let release,calls=0;
 s.register('import',()=>{calls++;return new Promise(r=>{release=r;});});
 const first=s.run('import');assert.equal(s.view().busy,true);await s.run('import');assert.equal(calls,1);
 release();await first;assert.equal(s.view().busy,false);
});
test('动态拆分状态：部分失败重试，待核对不能报完成',()=>{
 assert.equal(typeof api.create,'function');const s=api.create({brandsReady:true,inquiryReady:true,splitStarted:true,outputDirectory:'D:/test',split:{planned:3,complete:2,failed:1,pending:0,needsVerification:0,files:[]}});
 assert.equal(s.view().action,'splitRetry');assert.equal(s.view().step,7);
 s.set({split:{planned:3,complete:2,failed:0,pending:0,needsVerification:1,files:[]}});assert.equal(s.view().action,'splitVerify');
 s.set({split:{planned:3,complete:3,failed:0,pending:0,needsVerification:0,files:[]},splitVerified:true});
 assert.equal(s.view().action,'openFolder');assert.equal(s.view().step,8);assert.match(s.view().title,/3/);
});
test('全部无需询价结束，旧总簿过期时不能直接拆分',()=>{
 assert.equal(typeof api.create,'function');const s=api.create({reviewConfirmed:true,noInquiry:true});assert.equal(s.view().step,8);
 s.set({noInquiry:false,brandsReady:true,inquiryReady:false,inquiryStale:true,splitStarted:true});assert.equal(s.view().action,'inquiryGenerate');assert.equal(s.view().step,6);
});
test('文件已生成但项目保存失败，只重试保存，不重复生成或拆分',()=>{
 const s=api.create({brandsReady:true,inquiryPendingSave:true});
 assert.equal(s.view().action,'saveProject');assert.equal(s.view().step,6);
 s.set({inquiryPendingSave:false,inquiryReady:true,splitStarted:true,splitPendingSave:true,split:{planned:5,complete:5}});
 assert.equal(s.view().action,'saveProject');assert.equal(s.view().step,7);
});
test('预览打开失败仍有原位重试入口',()=>{
 const s=api.create({files:[{name:'A.xlsx'}],previewAvailable:false});
 assert.equal(s.view().action,'previewRetry');assert.equal(!!s.view().disabled,false);
});
test('品牌表打开也必须先可靠保存汇总绑定',()=>{
 const s=api.create({reviewConfirmed:true,categoriesReady:true,brandsOpened:true,summaryReady:false});
 assert.equal(s.view().step,4);assert.equal(s.view().action,'continueBrands');
 s.set({summaryReady:true});assert.equal(s.view().step,5);
});
test('新版分类簿生成而保存仍为旧版时，只重试保存',()=>{
 const s=api.create({reviewConfirmed:true,categoriesReady:false,categoriesPendingSave:true});
 assert.equal(s.view().step,4);assert.equal(s.view().action,'saveProject');
});
test('分类工作簿已存在但待核对时，主按钮核对现有文件而不是重复生成',()=>{
 const s=api.create({reviewConfirmed:true,categoriesRecover:true,categoriesReady:false});
 assert.equal(s.view().step,4);assert.equal(s.view().action,'categoriesGenerate');
 assert.equal(s.view().label,'核对现有分类工作簿');
 assert.match(s.view().description,/已经生成.*不会再写一份/);
});
test('返回已完成步骤只改变当前页面，保留全部业务状态并提供本步动作',()=>{
 const s=api.create({files:[{name:'示例.xlsx'}],previewAvailable:true,previewReviewed:true,mergeConfirmed:true,
  reviewGenerated:true,reviewOpened:true,reviewConfirmed:true,categoriesReady:true,summaryReady:true,brandsOpened:true,
  brandsReady:true,inquiryReady:true,splitStarted:true,outputDirectory:'D:/test',splitVerified:true,
  split:{planned:2,complete:2,failed:0,pending:0,needsVerification:0,completeWorkbookCount:1,files:[]},statusMessage:'原摘要'});
 assert.equal(typeof s.navigate,'function');const original=s.snapshot();
 const actions={1:'mergeConfirm',2:'reviewOpen',3:'reviewConfirm',4:'continueBrands',5:'brandsConfirm',6:'goSplit',7:'openFolder'};
 for(let step=7;step>=1;step--){
  assert.equal(s.navigate(step),true);assert.equal(s.view().step,step);assert.equal(s.view().action,actions[step]);
  assert.equal(s.view().progressStep,8);assert.deepEqual(s.snapshot(),original,'返回不能改业务完成标志');
  s.set({statusMessage:'状态刷新'});assert.equal(s.view().step,step,'刷新不弹回最后完成步骤');
  s.set({statusMessage:'原摘要'});
 }
 s.followProgress();assert.equal(s.view().step,8);
});
test('导航不能越过就绪步骤，业务处理中不能返回，上游失效后不能停在无效页面',()=>{
 const s=api.create({mergeConfirmed:true,reviewGenerated:true,reviewOpened:true});
 assert.equal(typeof s.navigate,'function');assert.equal(s.navigate(4),false);assert.equal(s.navigate(0),false);
 assert.equal(s.navigate('matching'),true);assert.equal(s.view().step,2);
 s.set({busy:true});assert.equal(s.navigate(1),false);assert.equal(s.view().step,2);
 s.set({busy:false,mergeConfirmed:false,reviewGenerated:false,reviewOpened:false});
 assert.equal(s.view().step,1,'来源或合并失效时回到真实阻断处');
});
test('第一步的整理选择、预览、选文件可逐级返回，不丢文件或合并选择',()=>{
 const s=api.create({files:[{name:'示例.xlsx'}],previewAvailable:true,previewReviewed:true,mergeIdentical:true});
 assert.equal(s.view().canBack,true,'整理方式页面也有上一步');
 assert.equal(typeof s.navigateImport,'function');const before=s.snapshot();
 s.navigateImport('preview');assert.equal(s.view().action,'previewConfirm');assert.equal(s.view().mergeVisible,false);
 assert.equal(s.view().backTarget.phase,'select');assert.deepEqual(s.snapshot(),before);
 s.navigateImport('select');assert.equal(s.view().action,'previewResume');assert.deepEqual(s.snapshot(),before);
 s.navigateImport('options');assert.equal(s.view().mergeVisible,true);
 s.set({files:[],previewReviewed:false,previewAvailable:false});
 assert.equal(s.view().canBack,false,'来源清空后不残留无效返回入口');assert.equal(s.view().action,'import');
});
