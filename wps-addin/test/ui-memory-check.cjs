// 记忆入口迁到图03整表确认，复用同一浏览器/模拟宿主夹具，增加首次写入失败与明确重试。
// 同时验证草稿不学习、快照先落盘、来源撤销、重复确认幂等和打开旧项目不再次学习。
require('./ui-sheet-review-check.cjs').run({memoryFailure:true})
 .then(()=>console.log('PASS: 表内整表确认的习惯保存失败可重试，确认不回滚，恢复不重复学习。'))
 .catch(error=>{console.error(error);process.exitCode=1;});
