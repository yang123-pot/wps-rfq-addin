const http = require('node:http');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const {prepareFiles,restoreCopy} = require('./import-files.cjs');
const {createExportStore} = require('./export-files.cjs');
const {createProjectStore} = require('./project-store.cjs');
const {createLibraryStore} = require('./library-store.cjs');
const {createHeaderStore} = require('./header-store.cjs');
const {createSplitStore} = require('./split-store.cjs');
const {listDirectory} = require('./fs-list.cjs');

const ASSETS = new Set(['/src/assistant-state.js','/src/assistant-problems.js','/src/assistant-feedback.js','/src/assistant-ui.js','/main.js', '/ribbon.xml', '/taskpane.html', '/styles.css', '/src/host.js',
  '/src/taskpane.js', '/src/parser.js', '/src/merge.js', '/src/review.js', '/src/review-ui.js',
  '/src/import-host.js', '/src/collection.js', '/src/import-ui.js', '/src/export-model.js',
  '/src/workbook-layout.js', '/src/workflow-ui.js', '/src/import-preview-model.js', '/src/export-host.js', '/src/export-ui.js', '/src/project.js', '/src/project-ui.js',
  '/src/project-host.js', '/src/category-library.js', '/src/classify.js', '/src/classification.js',
  '/src/classification-review-model.js', '/src/classification-review-host.js', '/src/classification-ui.js', '/src/category-memory.js', '/src/library-ui.js', '/src/project-restore.js', '/rules/defaults.json',
  '/src/category-workbooks.js',
  '/src/brand-table.js', '/src/brand-model.js', '/src/brand-host.js', '/src/brand-ui.js', '/src/decimal.js',
  '/src/brand-reference.js', '/src/inquiry-header.js', '/src/inquiry-model.js', '/src/split-plan.js',
  '/src/split-state.js', '/src/header-ui.js', '/src/inquiry-ui.js', '/src/split-ui.js',
  '/src/ribbon-navigation.js',
  '/src/path-picker.js', '/assets/inquiry.svg', '/assets/import.svg', '/assets/matching.svg',
  '/assets/review.svg', '/assets/categories.svg', '/assets/brands.svg', '/assets/split.svg']);
const TYPES = {'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.html':'text/html; charset=utf-8','.xml':'application/xml; charset=utf-8','.svg':'image/svg+xml',
  '.json':'application/json; charset=utf-8'};
const VERSION_SKIP_DIRECTORIES = new Set(['node_modules','.git','outputs','test','install','docs','__pycache__']);
const VERSION_SKIP_FILES = new Set(['server.pid','candidate-manifest.json']);

// 运行代码版本：按相对路径排序后逐个哈希文件，服务启动时计算一次。
// 安装脚本用同一算法核对“正在运行的代码”和“AppDir 中已安装的代码”是否一致。
function codeVersionForRoot(root) {
  const absolute = path.resolve(root);
  const lines = [];
  function walk(directory, relative) {
    let entries;
    try { entries = fsSync.readdirSync(directory, {withFileTypes:true}); } catch (_) { return; }
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      const nextRelative = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isDirectory()) {
        if (VERSION_SKIP_DIRECTORIES.has(entry.name)) continue;
        walk(path.join(directory, entry.name), nextRelative);
        continue;
      }
      if (!entry.isFile() || VERSION_SKIP_FILES.has(entry.name) || /\.(?:log|pid)$/i.test(entry.name)) continue;
      const bytes = fsSync.readFileSync(path.join(directory, entry.name));
      lines.push(nextRelative + '\n' + crypto.createHash('sha256').update(bytes).digest('hex'));
    }
  }
  walk(absolute, '');
  return crypto.createHash('sha256').update(lines.join('\n')).digest('hex');
}

function createServer({root, importDirectory = null, projectDirectory = null, libraryDirectory = null, headerDirectory = null, splitDirectory = null, extensions = null, mode = 'development'}) {
  const appDir = path.resolve(root);
  const startedAt = new Date(Date.now() - Math.round(process.uptime() * 1000)).toISOString();
  const identity = {
    service:'wps-rfq-addin',
    version:'0.1.0',
    mode,
    pid:process.pid,
    scriptPath:path.join(__dirname, 'server.cjs'),
    appDir,
    startedAt,
    codeVersion:codeVersionForRoot(appDir)
  };
  const importToken = crypto.randomBytes(32).toString('hex');
  const exports = importDirectory ? createExportStore({directory:path.join(importDirectory,'exports')}) : null;
  const projects = createProjectStore({directory: projectDirectory || path.join(process.env.LOCALAPPDATA || os.homedir(), 'WpsRfqAddin', 'projects')});
  const libraries = createLibraryStore({directory: libraryDirectory || path.join(process.env.LOCALAPPDATA || os.homedir(), 'WpsRfqAddin', 'library')});
  const headers = createHeaderStore({directory: headerDirectory || path.join(process.env.LOCALAPPDATA || os.homedir(), 'WpsRfqAddin', 'headers')});
  const splits = createSplitStore({directory: splitDirectory || path.join(process.env.LOCALAPPDATA || os.homedir(), 'WpsRfqAddin', 'splits')});
  let importing = false;
  const server = http.createServer(async (req, res) => {
    const origin = 'http://127.0.0.1:' + server.address().port;
    function reply(status, body, type = 'text/plain; charset=utf-8') {
      res.writeHead(status, {'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff'});
      res.end(req.method === 'HEAD' ? undefined : body);
    }
    if (req.headers.host !== '127.0.0.1:' + server.address().port ||
        (req.headers.origin && req.headers.origin !== origin)) return reply(403, 'Local origin required');
    let url;
    try { url = new URL(req.url, origin); } catch (_) { return reply(400, 'Invalid URL'); }
    if (extensions && typeof extensions.handle === 'function' &&
        await extensions.handle({req, res, url, reply})) return;
    if (['/api/import/prepare','/api/export/prepare','/api/export/freeze','/api/export/commit','/api/export/verify','/api/export/inspect','/api/export/discard'].includes(url.pathname)) {
      const json = (status,value) => reply(status,JSON.stringify(value),'application/json; charset=utf-8');
      if (!importDirectory) return json(404,{error:'当前服务未启用文件导入，请启动最新开发服务。'});
      if (req.method !== 'POST') return json(405,{error:'POST required'});
      if (req.headers['x-rfq-import-token'] !== importToken ||
          !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return json(403,{error:'导入会话失效，请重新打开侧栏。'});
      if (importing) return json(409,{error:'已有文件正在准备，请稍后重试。'});
      importing = true;
      try {
        let size=0; const chunks=[];
        for await (const chunk of req) { size+=chunk.length; if(size<=65536)chunks.push(chunk); }
        if(size>65536)return json(413,{error:'导入请求过大，请分批选择。'});
        let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch(_){return json(400,{error:'导入请求无效。'});}
        if(!data||Array.isArray(data))return json(400,{error:'导入请求无效。'});
        if(url.pathname==='/api/export/prepare')return json(200,await exports.prepare(data.target,
          {adjacent:data.adjacent===true,createParent:data.createParent===true,freezePlan:data.freezePlan}));
        if(url.pathname==='/api/export/freeze')return json(200,await exports.freeze(data.ticket));
        if(url.pathname==='/api/export/commit')return json(200,await exports.commit(data.ticket));
        if(url.pathname==='/api/export/verify')return json(200,await exports.verify(data.ticket,data.target,data.sha256));
        if(url.pathname==='/api/export/inspect')return json(200,await exports.inspect(data.target,data.sha256));
        if(url.pathname==='/api/export/discard')return json(200,await exports.discard(data.ticket));
        const files=await prepareFiles(data.paths,{directory:importDirectory,existing:data.existing});
        return json(200,{files});
      } catch(error) {return json(400,{error:error.message});}
      finally {importing=false;}
    }
    if (['/api/project/save','/api/project/load','/api/project/list','/api/project/restore-copy'].includes(url.pathname)) {
      const json = (status,value) => reply(status,JSON.stringify(value),'application/json; charset=utf-8');
      if (req.method !== 'POST') return json(405,{error:'POST required'});
      if (req.headers['x-rfq-import-token'] !== importToken ||
          !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return json(403,{error:'项目会话失效，请重新打开侧栏。'});
      try {
        let size=0; const chunks=[];
        for await (const chunk of req) { size+=chunk.length; if(size<=67108864)chunks.push(chunk); }
        if(size>67108864)return json(413,{error:'项目记录过大，未保存。'});
        let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch(_){return json(400,{error:'项目请求无效。'});}
        if(!data||Array.isArray(data))return json(400,{error:'项目请求无效。'});
        if(url.pathname==='/api/project/save')return json(200,await projects.save(data.project,{expectedRevision:data.expectedRevision}));
        if(url.pathname==='/api/project/load')return json(200,{project:await projects.load(data.projectId)});
        if(url.pathname==='/api/project/restore-copy'){
          if(!importDirectory)return json(404,{error:'当前服务未启用工作副本，请启动最新开发服务。'});
          return json(200,await restoreCopy(data.source,{directory:importDirectory}));
        }
        return json(200,{projects:await projects.list()});
      } catch(error) {
        if(error.code==='REVISION_CONFLICT')return json(409,{error:error.message});
        return json(400,{error:error.message});
      }
    }
    if (['/api/split/prepare','/api/split/load','/api/split/save','/api/split/copy-complete'].includes(url.pathname)) {
      const json = (status,value) => reply(status,JSON.stringify(value),'application/json; charset=utf-8');
      if (req.method !== 'POST') return json(405,{error:'POST required'});
      if (req.headers['x-rfq-import-token'] !== importToken ||
          !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return json(403,{error:'拆分回执会话失效，请重新打开侧栏。'});
      try {
        let size=0; const chunks=[];
        for await (const chunk of req) { size+=chunk.length; if(size<=33554432)chunks.push(chunk); }
        if(size>33554432)return json(413,{error:'拆分请求过大，未保存。'});
        let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch(_){return json(400,{error:'拆分请求无效。'});}
        if(!data||Array.isArray(data))return json(400,{error:'拆分请求无效。'});
        if(url.pathname==='/api/split/prepare')return json(200,await splits.prepare(data));
        if(url.pathname==='/api/split/copy-complete')return json(200,await splits.copyComplete(data));
        if(url.pathname==='/api/split/load')return json(200,{receipt:await splits.load(data.projectId,data.batchId)});
        return json(200,await splits.save(data.receipt,{expectedRevision:data.expectedRevision}));
      } catch(error) {
        if(error.code==='REVISION_CONFLICT')return json(409,{error:error.message});
        return json(400,{error:error.message});
      }
    }
    if (['/api/library/load','/api/library/save'].includes(url.pathname)) {
      const json = (status,value) => reply(status,JSON.stringify(value),'application/json; charset=utf-8');
      if (req.method !== 'POST') return json(405,{error:'POST required'});
      if (req.headers['x-rfq-import-token'] !== importToken ||
          !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return json(403,{error:'分类库会话失效，请重新打开侧栏。'});
      try {
        // Multi-project learned features exceed 4 MiB; keep a bounded budget like split receipts.
        const limit=33554432;
        let size=0; const chunks=[];
        for await (const chunk of req) { size+=chunk.length; if(size<=limit)chunks.push(chunk); }
        if(size>limit)return json(413,{error:'分类库请求过大，未保存。'});
        let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch(_){return json(400,{error:'分类库请求无效。'});}
        if(!data||Array.isArray(data))return json(400,{error:'分类库请求无效。'});
        if(url.pathname==='/api/library/load')return json(200,await libraries.load());
        return json(200,await libraries.save(data));
      } catch(error) {
        if(error.code==='REVISION_CONFLICT')return json(409,{error:error.message});
        return json(400,{error:error.message});
      }
    }
    if (['/api/header/load','/api/header/save'].includes(url.pathname)) {
      const json = (status,value) => reply(status,JSON.stringify(value),'application/json; charset=utf-8');
      if (req.method !== 'POST') return json(405,{error:'POST required'});
      if (req.headers['x-rfq-import-token'] !== importToken ||
          !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return json(403,{error:'抬头模板会话失效，请重新打开侧栏。'});
      try {
        let size=0; const chunks=[];
        for await (const chunk of req) { size+=chunk.length; if(size<=1048576)chunks.push(chunk); }
        if(size>1048576)return json(413,{error:'抬头模板请求过大，未保存。'});
        let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch(_){return json(400,{error:'抬头模板请求无效。'});}
        if(!data||Array.isArray(data))return json(400,{error:'抬头模板请求无效。'});
        if(url.pathname==='/api/header/load')return json(200,await headers.load());
        return json(200,await headers.save(data));
      } catch(error) {
        if(error.code==='REVISION_CONFLICT')return json(409,{error:error.message});
        return json(400,{error:error.message});
      }
    }
    if (url.pathname === '/api/fs/list') {
      const json = (status,value) => reply(status,JSON.stringify(value),'application/json; charset=utf-8');
      if (!importDirectory) return json(404,{error:'当前服务未启用侧栏文件浏览，请启动最新开发服务。'});
      if (req.method !== 'POST') return json(405,{error:'POST required'});
      if (req.headers['x-rfq-import-token'] !== importToken ||
          !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return json(403,{error:'侧栏会话失效，请重新打开侧栏。'});
      try {
        let size=0; const chunks=[];
        for await (const chunk of req) { size+=chunk.length; if(size<=8192)chunks.push(chunk); }
        if(size>8192)return json(413,{error:'目录请求过大。'});
        let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch(_){return json(400,{error:'目录请求无效。'});}
        if(!data||Array.isArray(data))return json(400,{error:'目录请求无效。'});
        return json(200,await listDirectory(data));
      } catch(error) {return json(400,{error:error.message});}
    }
    const isExtensionScript = extensions && typeof extensions.allowStatic === 'function' &&
      extensions.allowStatic(url.pathname);
    if (!ASSETS.has(url.pathname) && !isExtensionScript &&
        !['/health', '/', '/index.html'].includes(url.pathname)) return reply(404, 'Not found');
    if (req.method !== 'GET' && req.method !== 'HEAD') return reply(405, 'GET required');
    if (url.pathname === '/health') return reply(200, JSON.stringify(identity), 'application/json');
    if (url.pathname === '/' || url.pathname === '/index.html') {
      // WPS owns index.html. Supply its bootstrap in memory, not as a product file.
      const extra = extensions && typeof extensions.indexHtml === 'function' ? extensions.indexHtml() : '';
      return reply(200, '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
        '<script src="/main.js"></script>' + extra + '</body></html>', TYPES['.html']);
    }
    try {
      let content = await fs.readFile(path.join(root, url.pathname.slice(1)));
      if (importDirectory && url.pathname === '/taskpane.html') {
        content = content.toString('utf8').replace('<head>', '<head><script>window.__RFQ_IMPORT__=' +
          JSON.stringify({token:importToken,browse:true}) + ';</script>');
      }
      if (extensions && url.pathname === '/taskpane.html' && typeof extensions.transformTaskpane === 'function') {
        content = extensions.transformTaskpane(content.toString('utf8'));
      }
      return reply(200, content, TYPES[path.extname(url.pathname)] || 'application/octet-stream');
    } catch (_) { return reply(404, 'Not found'); }
  });
  return server;
}

async function main() {
  const args = process.argv.slice(2);
  function arg(name, fallback) { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; }
  if (args.includes('--code-version')) {
    const rootArg = arg('--code-version', null);
    if (!rootArg) throw new Error('--code-version requires a directory');
    process.stdout.write(codeVersionForRoot(path.resolve(rootArg)) + '\n');
    return;
  }
  const port = Number(arg('--port', '38891'));
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid port');
  const importDirectory=path.resolve(arg('--import-directory',path.join(process.env.LOCALAPPDATA || os.homedir(),'WpsRfqAddin','imports')));
  const libraryDirectory=path.resolve(arg('--library-directory',path.join(process.env.LOCALAPPDATA || os.homedir(),'WpsRfqAddin','library')));
  const projectDirectory=path.resolve(arg('--project-directory',path.join(process.env.LOCALAPPDATA || os.homedir(),'WpsRfqAddin','projects')));
  const headerDirectory=path.resolve(arg('--header-directory',path.join(process.env.LOCALAPPDATA || os.homedir(),'WpsRfqAddin','headers')));
  const splitDirectory=path.resolve(arg('--split-directory',path.join(process.env.LOCALAPPDATA || os.homedir(),'WpsRfqAddin','splits')));
  const server = createServer({root:path.resolve(__dirname,'..'),importDirectory,libraryDirectory,projectDirectory,headerDirectory,splitDirectory});
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log('WPS add-in ready: http://127.0.0.1:' + port));
}
if (require.main === module) main().catch(error => {console.error(error.message);process.exitCode=1;});
module.exports = {createServer,codeVersionForRoot};
