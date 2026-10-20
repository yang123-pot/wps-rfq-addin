/*
 * 开发/验收专用入口：生产服务 dev/server.cjs 不再包含探针路由或诊断脚本注入。
 * 需要旧探针模式时改用：
 *   node dev/probe-server.cjs --report <json> --probe-output <xlsx> [--source <xls>]
 * 该文件不进入发布候选包。
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { createServer, codeVersionForRoot } = require('./server.cjs');

function createProbeExtension(probeConfig, reportPath) {
  const reports = [];
  let writes = Promise.resolve();
  return {
    async handle({ req, res, url, reply }) {
      if (url.pathname !== '/__probe/report') return false;
      if (req.method !== 'POST') { reply(405, 'POST required'); return true; }
      if (req.headers['x-rfq-probe-token'] !== probeConfig.token) { reply(403, 'Invalid probe token'); return true; }
      let size = 0;
      const chunks = [];
      try {
        for await (const chunk of req) {
          size += chunk.length;
          if (size <= 65536) chunks.push(chunk);
        }
        if (size > 65536) { reply(413, 'Report too large'); return true; }
        let report;
        try { report = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_) { reply(400, 'Invalid JSON'); return true; }
        if (!report || typeof report.stage !== 'string' || report.stage.length > 80 || Array.isArray(report)) {
          reply(400, 'Invalid report');
          return true;
        }
        reports.push({ ...report, receivedAt: new Date().toISOString() });
        if (reports.length > 100) {
          const heartbeat = reports.findIndex(item => item.stage === 'pane-heartbeat');
          reports.splice(heartbeat < 0 ? 0 : heartbeat, 1);
        }
        const data = JSON.stringify({ reports }, null, 2);
        writes = writes.catch(() => {}).then(() => fs.writeFile(reportPath, data, 'utf8'));
        await writes;
        reply(200, '{"ok":true}', 'application/json');
      } catch (_) {
        reply(500, 'Could not save probe report');
      }
      return true;
    },
    indexHtml() {
      return '<script>window.__RFQ_PROBE__=' +
        JSON.stringify(probeConfig).replace(/</g, '\\u003c') +
        ';</script><script src="/dev/host-probe.js"></script>';
    },
    allowStatic(pathname) {
      return ['/dev/host-probe.js', '/dev/pane-diagnostics.js', '/dev/acceptance-probe.js'].includes(pathname);
    },
    transformTaskpane(content) {
      const token = JSON.stringify(probeConfig.token);
      return content.replace('</body>', '<script>window.__RFQ_PANE_PROBE__={token:' + token + '};</script>' +
        '<script src="/dev/pane-diagnostics.js"></script><script src="/dev/acceptance-probe.js"></script></body>');
    }
  };
}

function createProbeServer({ root, probeConfig = null, reportPath = null, importDirectory = null,
  projectDirectory = null, libraryDirectory = null, headerDirectory = null, splitDirectory = null }) {
  if (!probeConfig || !reportPath) throw new Error('Probe requires probeConfig and reportPath');
  return createServer({
    root,
    importDirectory,
    projectDirectory,
    libraryDirectory,
    headerDirectory,
    splitDirectory,
    mode: 'probe',
    extensions: createProbeExtension(probeConfig, reportPath)
  });
}

async function prepareProbeSources(sourcePaths, outputDirectory) {
  if (!sourcePaths.length) return [];
  const directory = await fs.mkdtemp(path.join(outputDirectory, 'probe-inputs-'));
  const manifest = [];
  for (let index = 0; index < sourcePaths.length; index++) {
    const original = path.resolve(sourcePaths[index]);
    const extension = path.extname(original).toLowerCase();
    if (!['.xls', '.xlsx'].includes(extension)) throw new Error('Probe source must be xls or xlsx');
    const copied = path.join(directory, 'source-' + (index + 1) + extension);
    const bytes = await fs.readFile(original);
    await fs.writeFile(copied, bytes, { flag: 'wx' });
    manifest.push({ original, copied, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
  }
  await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
  return manifest.map(item => item.copied);
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
  const reportPath = arg('--report', null);
  const outputPath = arg('--probe-output', null);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid port');
  if ((reportPath && !outputPath) || (!reportPath && outputPath)) throw new Error('Probe requires --report and --probe-output');
  const inputPaths = args.reduce((out, value, i) => value === '--source' ? out.concat(path.resolve(args[i + 1])) : out, []);
  if (inputPaths.length && !outputPath) throw new Error('--source requires probe mode');
  const sourcePaths = outputPath ? await prepareProbeSources(inputPaths, path.dirname(path.resolve(outputPath))) : [];
  const probeConfig = outputPath ? {
    token: crypto.randomBytes(24).toString('hex'),
    outputPath: path.resolve(outputPath),
    sourcePaths
  } : null;
  const importDirectory = path.resolve(arg('--import-directory', path.join(process.env.LOCALAPPDATA || os.homedir(), 'WpsRfqAddin', 'imports')));
  const libraryDirectory = path.resolve(arg('--library-directory', path.join(process.env.LOCALAPPDATA || os.homedir(), 'WpsRfqAddin', 'library')));
  const projectDirectory = path.resolve(arg('--project-directory', path.join(process.env.LOCALAPPDATA || os.homedir(), 'WpsRfqAddin', 'projects')));
  const headerDirectory = path.resolve(arg('--header-directory', path.join(process.env.LOCALAPPDATA || os.homedir(), 'WpsRfqAddin', 'headers')));
  const splitDirectory = path.resolve(arg('--split-directory', path.join(process.env.LOCALAPPDATA || os.homedir(), 'WpsRfqAddin', 'splits')));
  const server = createProbeServer({
    root: path.resolve(__dirname, '..'),
    probeConfig,
    reportPath: reportPath && path.resolve(reportPath),
    importDirectory,
    libraryDirectory,
    projectDirectory,
    headerDirectory,
    splitDirectory
  });
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log('WPS add-in ready: http://127.0.0.1:' + port + ' (probe enabled)'));
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { createProbeServer, prepareProbeSources };
