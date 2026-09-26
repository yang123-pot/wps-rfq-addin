const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {listDirectory,quickRoots,MAX_ENTRIES}=require('../dev/fs-list.cjs');

async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-fs-list-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await fs.mkdir(path.join(root,'子目录'));
 await fs.writeFile(path.join(root,'清单甲.xlsx'),'a');
 await fs.writeFile(path.join(root,'清单乙.XLS'),'b');
 await fs.writeFile(path.join(root,'说明.txt'),'c');
 return root;
}

test('列目录只列一层，目录在前，可按扩展名过滤且大小写不敏感',async t=>{
 const root=await fixture(t);
 const all=await listDirectory({path:root});
 assert.equal(all.path,path.resolve(root));
 assert.equal(all.parent,path.dirname(path.resolve(root)));
 assert.equal(all.entries[0].type,'directory','目录必须排在文件前面');
 assert.deepEqual(all.entries.map(item=>item.type).filter(type=>type==='directory').length,1);
 assert.deepEqual(all.entries.filter(item=>item.type==='file').map(item=>item.name).sort(),
  ['清单乙.XLS','清单甲.xlsx','说明.txt'].sort());
 assert.equal(all.truncated,false);
 const filtered=await listDirectory({path:root,extensions:['.xlsx','.xls']});
 assert.deepEqual(filtered.entries.filter(item=>item.type==='file').map(item=>item.name).sort(),
  ['清单乙.XLS','清单甲.xlsx'].sort(),'扩展名过滤必须忽略大小写，并保留目录');
 assert.equal(filtered.entries.some(item=>item.name==='说明.txt'),false);
 const file=filtered.entries.find(item=>item.name==='清单甲.xlsx');
 assert.equal(typeof file.size,'number');
 assert.match(file.modifiedAt,/^\d{4}-\d{2}-\d{2}T/);
});

test('空路径返回本机快捷位置，坏路径明确失败而不是静默返回空目录',async t=>{
 const root=await fixture(t);
 const roots=await listDirectory({});
 assert.equal(roots.path,'');
 assert.deepEqual(roots.entries,[]);
 assert.ok(roots.roots.length>0,'至少要给出一个可进入的位置');
 assert.equal(roots.roots.every(item=>item.type==='directory'&&typeof item.path==='string'),true);
 await assert.rejects(()=>listDirectory({path:path.join(root,'不存在')}),/目录不存在或无法访问/);
 await assert.rejects(()=>listDirectory({path:path.join(root,'清单甲.xlsx')}),/不是目录/);
 assert.deepEqual((await quickRoots()).slice(0,1).map(item=>item.type),['directory']);
});

test('大目录按上限截断并保留全部子目录',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'rfq-fs-big-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 for(let index=0;index<MAX_ENTRIES+5;index++)await fs.writeFile(path.join(root,'文件'+String(index).padStart(4,'0')+'.xlsx'),'x');
 await fs.mkdir(path.join(root,'子目录'));
 const listed=await listDirectory({path:root,extensions:['.xlsx']});
 assert.equal(listed.truncated,true);
 assert.equal(listed.total,MAX_ENTRIES+6);
 assert.ok(listed.entries.length<=MAX_ENTRIES);
 assert.equal(listed.entries[0].name,'子目录','截断不能吃掉子目录');
 assert.equal(listed.shown,listed.entries.length);
});
