/*
 * 侧栏内置文件选择器用的只读目录列表。
 *
 * 为什么要内置选择器：2026-09-26 实机证据显示，原生模态文件对话框（Application.GetOpenFilename /
 * GetSaveAsFilename）弹出时，WPS 侧栏内嵌网页的合成器停摆（rAF 不再回调），导入之后的画面全部冻结，
 * 只能重建侧栏才能恢复。这里只读列目录，让侧栏自己就能选文件，不必再弹系统对话框。
 *
 * 边界：只读、只列一层、单次最多 MAX_ENTRIES 项；没有删除、改名或覆盖能力。
 */
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');

const MAX_ENTRIES = 400;
const MAX_EXTENSIONS = 20;
const DRIVE_LETTERS = 'CDEFGHIJKLMNOPQRSTUVWXYZ';

async function exists(target) {
  try { await fs.access(target); return true; } catch (_) { return false; }
}

function normalizeExtensions(value) {
  if (!Array.isArray(value)) return [];
  return value.map(item => String(item || '').trim().toLowerCase())
    .filter(item => /^\.[a-z0-9]{1,8}$/.test(item)).slice(0, MAX_EXTENSIONS);
}

async function quickRoots() {
  const roots = [];
  for (const letter of DRIVE_LETTERS) {
    const drive = letter + ':\\';
    if (await exists(drive)) roots.push({name:'本地磁盘 (' + letter + ':) ' + drive, path:drive, type:'directory'});
  }
  if (!roots.length) roots.push({name:'系统盘 (C:) C:\\', path:'C:\\', type:'directory'});
  const home = process.env.USERPROFILE || process.env.HOME || '';
  if (home) {
    for (const [label, folder] of [['桌面', 'Desktop'], ['文档', 'Documents'], ['下载', 'Downloads']]) {
      const target = path.join(home, folder);
      if (await exists(target)) roots.push({name:label + ' ' + target, path:target, type:'directory'});
    }
  }
  return roots;
}

async function describe(target) {
  const info = {name:path.basename(target) || target, path:target, type:'file', extension:path.extname(target).toLowerCase()};
  try {
    const stat = await fs.stat(target);
    info.size = stat.size;
    info.modifiedAt = stat.mtime.toISOString();
  } catch (_) { /* 只读信息拿不到时仍然列出文件，不做修复或写入。 */ }
  return info;
}

async function listDirectory(request) {
  const asked = request && typeof request.path === 'string' ? request.path.trim() : '';
  if (!asked) return {path:'', parent:null, roots:await quickRoots(), entries:[], truncated:false, shown:0, total:0};
  const target = path.resolve(asked);
  let stat;
  try {
    stat = await fs.stat(target);
  } catch (_) {
    throw new Error('目录不存在或无法访问：' + target);
  }
  if (!stat.isDirectory()) throw new Error('不是目录：' + target);
  const extensions = normalizeExtensions(request.extensions);
  let raw;
  try {
    raw = await fs.readdir(target, {withFileTypes:true});
  } catch (_) {
    throw new Error('没有权限读取目录：' + target);
  }
  const directories = [], fileNames = [];
  for (const entry of raw) {
    if (!entry || !entry.name || entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) directories.push({name:entry.name, path:path.join(target, entry.name), type:'directory'});
    else if (entry.isFile() && (!extensions.length || extensions.indexOf(path.extname(entry.name).toLowerCase()) >= 0)) fileNames.push(entry.name);
  }
  const collator = new Intl.Collator('zh-Hans-CN', {numeric:true, sensitivity:'base'});
  directories.sort((left, right) => collator.compare(left.name, right.name));
  fileNames.sort((left, right) => collator.compare(left, right));
  const total = directories.length + fileNames.length;
  const planned = directories.concat(fileNames.slice(0, Math.max(0, MAX_ENTRIES - directories.length))
    .map(name => ({name, path:path.join(target, name), type:'file'})));
  const entries = [];
  for (const entry of planned.slice(0, MAX_ENTRIES)) {
    entries.push(entry.type === 'file' ? await describe(entry.path) : entry);
  }
  const parent = path.dirname(target);
  return {path:target, parent:parent === target ? null : parent, roots:await quickRoots(), entries,
    truncated:total > MAX_ENTRIES, shown:entries.length, total};
}

module.exports = {listDirectory, quickRoots, normalizeExtensions, MAX_ENTRIES};
