// 2026-10-11（图04/05变更）：分类工作簿改为“一本多页”，页名＝类别名——先锁死页名规则。
const test = require('node:test'), assert = require('node:assert/strict');
const books = require('../src/category-workbooks.js');

test('页名＝类别名；非法字符换成下划线、去掉首尾单引号，顿号原样保留', () => {
  const taken = {};
  assert.equal(books.sheetNameFor('配电箱', taken), '配电箱');
  taken['配电箱'] = true;
  assert.equal(books.sheetNameFor('风口、风阀', taken), '风口、风阀', '顿号是合法页名字符');
  assert.equal(books.sheetNameFor("'带引号'", taken), '带引号');
  assert.equal(books.sheetNameFor('A/B\\C:D*E?F[G]', taken), 'A_B_C_D_E_F_G_');
  assert.equal(books.sheetNameFor('   ', taken), '分类', '空名兜底');
});

test('超 31 字符截断，且簿内重名自动加尾号而不是阻断生成', () => {
  const taken = {};
  const long = books.sheetNameFor('超长类别名称'.repeat(6), taken); // 36 字
  assert.equal(long.length, 31, '页名上限 31 字符');
  taken[long.toLowerCase()] = true;
  const second = books.sheetNameFor('超长类别名称'.repeat(6), taken);
  assert.equal(second.length <= 31, true, '加尾号后仍不超过 31');
  assert.notEqual(second, long, '重名时另起页名');
  assert.match(second, /\(2\)$/);
});
