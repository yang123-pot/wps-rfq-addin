const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function probe() {
  const reports = [], frames = [], events = {}, intervals = [];
  let now = 0;
  const document = {readyState:'complete',visibilityState:'visible',hasFocus:()=>true,
    activeElement:{tagName:'BODY'},documentElement:{scrollHeight:1000},
    querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null};
  const window = {__RFQ_PANE_PROBE__:{token:'test'},scrollY:0,innerHeight:600,
    requestAnimationFrame(callback){frames.push(callback);},
    setInterval(callback){intervals.push(callback);},
    addEventListener(type,callback){(events[type] ||= []).push(callback);}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dev/pane-diagnostics.js'),'utf8'),
    {window,document,Date:{now:()=>now},Math,
      fetch:(_url,options)=>{reports.push(JSON.parse(options.body));return Promise.resolve();}});
  return {reports,frames,document,
    emit(type){for(const callback of events[type] || []) callback({target:document});},
    tick(){now+=3000;intervals.forEach(callback=>callback());},
    paint(){frames.splice(0).forEach(callback=>callback());}};
}

test('a stalled pane probe keeps only one pending animation callback and reports recovery',()=>{
  const p=probe();p.emit('load');
  for(let i=0;i<20;i++)p.tick();
  assert.equal(p.frames.length,1,'a frozen host must not accumulate animation callbacks');
  const stalled=p.reports.filter(r=>r.stage==='pane-render-stalled');
  assert.equal(stalled.length,1,'retain one transition instead of flooding the report');
  assert.equal(stalled[0].visibility,'visible');
  assert.ok(stalled[0].framePendingMs>=9000);
  p.paint();
  assert.equal(p.reports.filter(r=>r.stage==='pane-render-resumed').length,1);
  p.tick();p.paint();p.tick();p.paint();
  assert.equal(p.frames.length,0);
  assert.equal(p.reports.filter(r=>r.stage==='pane-render-stalled').length,1);
});

test('hidden pages are recorded as lifecycle changes instead of render failures',()=>{
  const p=probe();p.emit('load');p.document.visibilityState='hidden';p.emit('visibilitychange');
  for(let i=0;i<10;i++)p.tick();
  assert.equal(p.reports.filter(r=>r.stage==='pane-render-stalled').length,0);
  assert.ok(p.reports.some(r=>r.stage==='pane-lifecycle'&&r.event==='visibilitychange'&&r.visibility==='hidden'));
  p.document.visibilityState='visible';p.emit('visibilitychange');p.paint();p.tick();p.paint();
  assert.equal(p.reports.filter(r=>r.stage==='pane-render-stalled').length,0);
});
