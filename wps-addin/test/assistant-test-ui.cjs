// 旧业务回归继续操作前，像用户一样确认新增的错误提醒；不改页面状态或业务断言。
async function acknowledgeProblems(page){
 const locator=page.getByRole('alertdialog');
 const handler=async dialog=>{
  await dialog.getByRole('button',{name:/^(我知道了|暂不处理)$/}).click();
 };
 await page.addLocatorHandler(locator,handler);
 return {locator,handler};
}
module.exports={acknowledgeProblems};
