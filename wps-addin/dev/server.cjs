const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const {prepareFiles,restoreCopy} = require('./import-files.cjs');
const {createExportStore} = require('./export-files.cjs');
const {createProjectStore} = require('./project-store.cjs');
const {createLibraryStore} = require('./library-store.cjs');
const {createHeaderStore} = require('./header-store.cjs');
const {listDirectory} = require('./fs-list.cjs');

const ASSETS = new Set(['/main.js', '/ribbon.xml', '/taskpane.html', '/styles.css', '/src/host.js',
  '/src/taskpane.js', '/src/parser.js', '/src/merge.js', '/src/review.js', '/src/review-ui.js',
  '/src/import-host.js', '/src/collection.js', '/src/import-ui.js', '/src/export-model.js',
  '/src/export-host.js', '/src/export-ui.js', '/src/project.js', '/src/project-ui.js',
  '/src/project-host.js', '/src/category-library.js', '/src/classify.js', '/src/classification.js',
  '/src/classification-ui.js', '/src/category-memory.js', '/src/library-ui.js', '/rules/defaults.json',
  '/src/brand-table.js', '/src/brand-model.js', '/src/brand-host.js', '/src/brand-ui.js', '/src/decimal.js',
  '/src/brand-reference.js', '/src/inquiry-header.js', '/src/inquiry-model.js', '/src/split-plan.js',
  '/src/split-state.js', '/src/header-ui.js', '/src/inquiry-ui.js', '/src/split-ui.js',
  '/src/path-picker.js', '/assets/inquiry.svg']);
const TYPES = {'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.html':'text/html; charset=utf-8','.xml':'application/xml; charset=utf-8','.svg':'image/svg+xml',
  '.json':'application/json; charset=utf-8'};

function createServer({root, probeConfig = null, reportPath = null, importDirectory = null, projectDirectory = null, libraryDirectory = null, headerDirectory = null}) {
  const reports = [];
  let writes = Promise.resolve();
  const importToken = crypto.randomBytes(32).toString('hex');
  const exports = importDirectory ? createExportStore({directory:path.join(importDirectory,'exports')}) : null;
  const projects = createProjectStore({directory: projectDirectory || path.join(process.env.LOCALAPPDATA || os.homedir(), 'WpsRfqAddin', 'projects')});
  const libraries = createLibraryStore({directory: libraryDirectory || path.join(process.env.LOCALAPPDATA || os.homedir(), 'WpsRfqAddin', 'library')});
  const headers = createHeaderStore({directory: headerDirectory || path.join(process.env.LOCALAPPDATA || os.homedir(), 'WpsRfqAddin', 'headers')});
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
    if (['/api/import/prepare','/api/export/prepare','/api/export/commit','/api/export/verify'].includes(url.pathname)) {
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
        if(url.pathname==='/api/export/prepare')return json(200,await exports.prepare(data.target));
        if(url.pathname==='/api/export/commit')return json(200,await exports.commit(data.ticket));
        if(url.pathname==='/api/export/verify')return json(200,await exports.verify(data.ticket,data.target,data.sha256));
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
    if (['/api/library/load','/api/library/save'].includes(url.pathname)) {
      const json = (status,value) => reply(status,JSON.stringify(value),'application/json; charset=utf-8');
      if (req.method !== 'POST') return json(405,{error:'POST required'});
      if (req.headers['x-rfq-import-token'] !== importToken ||
          !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return json(403,{error:'分类库会话失效，请重新打开侧栏。'});
      try {
        let size=0; const chunks=[];
        for await (const chunk of req) { size+=chunk.length; if(size<=4194304)chunks.push(chunk); }
        if(size>4194304)return json(413,{error:'分类库请求过大，未保存。'});
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
    if (url.pathname === '/__probe/report') {
      if (!probeConfig || !reportPath) return reply(404, 'Not found');
      if (req.method !== 'POST') return reply(405, 'POST required');
      if (req.headers['x-rfq-probe-token'] !== probeConfig.token) return reply(403, 'Invalid probe token');
      let size = 0;
      const chunks = [];
      try {
        for await (const chunk of req) {
          size += chunk.length;
          if (size <= 65536) chunks.push(chunk);
        }
        if (size > 65536) return reply(413, 'Report too large');
        let report;
        try { report = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_) { return reply(400, 'Invalid JSON'); }
        if (!report || typeof report.stage !== 'string' || report.stage.length > 80 || Array.isArray(report)) return reply(400, 'Invalid report');
        reports.push({...report, receivedAt: new Date().toISOString()});
        if (reports.length > 100) {
          const heartbeat = reports.findIndex(item => item.stage === 'pane-heartbeat');
          reports.splice(heartbeat < 0 ? 0 : heartbeat, 1);
        }
        const data = JSON.stringify({reports}, null, 2);
        writes = writes.catch(() => {}).then(() => fs.writeFile(reportPath, data, 'utf8'));
        await writes;
        return reply(200, '{"ok":true}', 'application/json');
      } catch (_) { return reply(500, 'Could not save probe report'); }
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return reply(405, 'GET required');
    if (url.pathname === '/health') return reply(200, JSON.stringify({service:'wps-rfq-addin',version:'0.1.0',
      mode:probeConfig ? 'probe' : 'development'}), 'application/json');
    if (url.pathname === '/' || url.pathname === '/index.html') {
      // WPS owns index.html. Supply its bootstrap in memory, not as a product file.
      const probe = probeConfig ? '<script>window.__RFQ_PROBE__=' +
        JSON.stringify(probeConfig).replace(/</g, '\\u003c') + ';</script><script src="/dev/host-probe.js"></script>' : '';
      return reply(200, '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
        '<script src="/main.js"></script>' + probe + '</body></html>', TYPES['.html']);
    }
    const isProbeScript = probeConfig &&
      ['/dev/host-probe.js','/dev/pane-diagnostics.js','/dev/acceptance-probe.js'].includes(url.pathname);
    if (!ASSETS.has(url.pathname) && !isProbeScript) return reply(404, 'Not found');
    try {
      let content = await fs.readFile(path.join(root, url.pathname.slice(1)));
      if (importDirectory && url.pathname === '/taskpane.html') {
        content = content.toString('utf8').replace('<head>', '<head><script>window.__RFQ_IMPORT__=' +
          JSON.stringify({token:importToken,browse:true}) + ';</script>');
      }
      if (probeConfig && url.pathname === '/taskpane.html') {
        const token = JSON.stringify(probeConfig.token);
        content = content.toString('utf8').replace('</body>', '<script>window.__RFQ_PANE_PROBE__={token:' + token + '};</script>' +
          '<script src="/dev/pane-diagnostics.js"></script><script src="/dev/acceptance-probe.js"></script></body>');
      }
      return reply(200, content, TYPES[path.extname(url.pathname)] || 'application/octet-stream');
    } catch (_) { return reply(404, 'Not found'); }
  });
  return server;
}

async function prepareProbeSources(sourcePaths, outputDirectory) {
  if (!sourcePaths.length) return [];
  const directory = await fs.mkdtemp(path.join(outputDirectory, 'probe-inputs-'));
  const manifest = [];
  for (let index = 0; index < sourcePaths.length; index++) {
    const original = path.resolve(sourcePaths[index]);
    const extension = path.extname(original).toLowerCase();
    if (!['.xls','.xlsx'].includes(extension)) throw new Error('Probe source must be xls or xlsx');
    const copied = path.join(directory, 'source-' + (index + 1) + extension);
    const bytes = await fs.readFile(original);
    await fs.writeFile(copied, bytes, {flag:'wx'});
    manifest.push({original,copied,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  }
  await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest,null,2), {flag:'wx'});
  return manifest.map(item => item.copied);
}

async function main() {
  const args = process.argv.slice(2);
  function arg(name, fallback) { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; }
  const port = Number(arg('--port', '38891'));
  const reportPath = arg('--report', null);
  const outputPath = arg('--probe-output', null);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid port');
  if ((reportPath && !outputPath) || (!reportPath && outputPath)) throw new Error('Probe requires --report and --probe-output');
  const inputPaths = args.reduce((out, value, i) => value === '--source' ? out.concat(path.resolve(args[i + 1])) : out, []);
  if (inputPaths.length && !outputPath) throw new Error('--source requires probe mode');
  const sourcePaths = outputPath ? await prepareProbeSources(inputPaths, path.dirname(path.resolve(outputPath))) : [];
  const probeConfig = outputPath ? {token:crypto.randomBytes(24).toString('hex'), outputPath:path.resolve(outputPath),sourcePaths} : null;
  const importDirectory=path.resolve(arg('--import-directory',path.join(process.env.LOCALAPPDATA || os.homedir(),'WpsRfqAddin','imports')));
  const libraryDirectory=path.resolve(arg('--library-directory',path.join(process.env.LOCALAPPDATA || os.homedir(),'WpsRfqAddin','library')));
  const projectDirectory=path.resolve(arg('--project-directory',path.join(process.env.LOCALAPPDATA || os.homedir(),'WpsRfqAddin','projects')));
  const headerDirectory=path.resolve(arg('--header-directory',path.join(process.env.LOCALAPPDATA || os.homedir(),'WpsRfqAddin','headers')));
  const server = createServer({root:path.resolve(__dirname,'..'),probeConfig,reportPath:reportPath && path.resolve(reportPath),importDirectory,libraryDirectory,projectDirectory,headerDirectory});
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log('WPS add-in ready: http://127.0.0.1:' + port + (probeConfig ? ' (probe enabled)' : '')));
}
if (require.main === module) main().catch(error => {console.error(error.message);process.exitCode=1;});
module.exports = {createServer,prepareProbeSources};
