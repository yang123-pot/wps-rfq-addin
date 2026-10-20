// 旧业务回归继续操作前，像用户一样确认新增的错误提醒；不改页面状态或业务断言。
async function acknowledgeProblems(page){
 const locator=page.getByRole('alertdialog');
 const handler=async dialog=>{
  await dialog.getByRole('button',{name:'返回上一步',exact:true}).click();
 };
 await page.addLocatorHandler(locator,handler);
 return {locator,handler};
}
module.exports={acknowledgeProblems};
