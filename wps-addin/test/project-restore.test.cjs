const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {restoreCopy}=require('../dev/import-files.cjs'),{createServer}=require('../dev/server.cjs');
function digest(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
test('rebuilds a missing copy only while the original still matches the saved fingerprint',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-restore-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const directory=path.join(root,'copies'),original=path.join(root,'测试一.xlsx'),bytes=Buffer.from('original bytes');
 await fs.writeFile(original,bytes);
 const fingerprint=digest(bytes),source={originalPath:original,originalName:'测试一.xlsx',fingerprint,copyPath:path.join(directory,'gone.xlsx')};
 const rebuilt=await restoreCopy(source,{directory});
 assert.equal(rebuilt.rebuilt,true);assert.notEqual(rebuilt.copyPath,source.copyPath);
 assert.deepEqual(await fs.readFile(rebuilt.copyPath),bytes);
 assert.equal((await restoreCopy({...source,copyPath:rebuilt.copyPath},{directory})).rebuilt,false,'副本已存在时不得重复复制');
 const changed=path.join(directory,'gone2.xlsx');
 await fs.writeFile(original,'changed bytes');
 await assert.rejects(restoreCopy({...source,copyPath:changed},{directory}),/原件内容已变化/);
 assert.equal(await fs.stat(changed).then(()=>true,()=>false),false,'指纹不一致时不得写出副本');
 await fs.rm(original);
 await assert.rejects(restoreCopy({...source,copyPath:changed},{directory}),/原件不存在/);
 await assert.rejects(restoreCopy({originalPath:original,originalName:'x.xlsx',fingerprint:'zz',copyPath:changed},{directory}),/标识无效/);
});
test('the restore endpoint keeps the local session gate and only writes into the copy directory',async t=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-restore-api-'));
 const server=createServer({root:path.resolve(__dirname,'..'),importDirectory:path.join(folder,'copies'),projectDirectory:path.join(folder,'projects')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));await fs.rm(folder,{recursive:true,force:true});});
 const original=path.join(folder,'二号.xls'),bytes=Buffer.from('copy me');
 await fs.writeFile(original,bytes);
 const source={originalPath:original,originalName:'二号.xls',fingerprint:digest(bytes),copyPath:path.join(folder,'copies','missing.xls')};
 const origin='http://127.0.0.1:'+server.address().port,html=await(await fetch(origin+'/taskpane.html')).text();
 const token=JSON.parse(html.match(/window\.__RFQ_IMPORT__=(\{[^;]+\});/)[1]).token;
 const post=headers=>fetch(origin+'/api/project/restore-copy',{method:'POST',headers,body:JSON.stringify({source})});
 assert.equal((await post({'content-type':'application/json'})).status,403);
 const response=await post({'content-type':'application/json','x-rfq-import-token':token});
 assert.equal(response.status,200);
 const result=await response.json();
 assert.equal(result.rebuilt,true);assert.deepEqual(await fs.readFile(result.copyPath),bytes);
 assert.equal(path.dirname(result.copyPath).startsWith(path.join(folder,'copies')),true,'副本只能落在配置的副本目录内');
});
