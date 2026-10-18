// 旧业务回归继续操作前，像用户一样确认新增的错误提醒；不改页面状态或业务断言。
async function acknowledgeProblems(page){
 await page.addLocatorHandler(page.getByRole('alertdialog'),async dialog=>{
  await dialog.getByRole('button',{name:/^(我知道了|暂不处理)$/}).click();
 });
}
module.exports={acknowledgeProblems};
