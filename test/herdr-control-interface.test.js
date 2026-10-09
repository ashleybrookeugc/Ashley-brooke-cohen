import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalWorkerControlInterface} from '../src/local-workers/control-interface.js';

async function withInterface(options,run) {
  const view=createLocalWorkerControlInterface(options);
  const started=await view.start();
  try { await run(started); }
  finally { await view.stop(); }
}

test('local worker endpoint remains disabled by default without touching the adapter',async()=>{
  let calls=0;
  await withInterface({adapter:{list:async()=>{calls++;return [];}}},async({url})=>{
    const response=await fetch(new URL('/api/control/workers',url));
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.version,'mary-kate.local-workers.v1');
    assert.equal(body.enabled,false);
    assert.equal(body.read_only,true);
    assert.equal(body.connection.state,'disconnected');
    assert.deepEqual(body.workers,[]);
    assert.equal(typeof body.observed_at,'string');
  });
  assert.equal(calls,0);
});

test('enabled endpoint returns only read-only worker snapshots and has no launch route',async()=>{
  const worker={id:'herdr:test:w1:worker',task:{id:'test',summary:'Visible real task'},state:'running',state_source:'herdr',outcome_verified:false,runtime_metrics:{model:null,tokens:null,cost:null},last_observed_at:'2026-10-09T12:00:00.000Z',progress_events:[],identity:{session:'test',workspace_id:'w1',pane_id:'w1:p1',agent_name:'worker'}};
  await withInterface({enabled:true,adapter:{list:async()=>[worker]},now:()=> '2026-10-09T12:00:01.000Z'},async({url,address})=>{
    assert.equal(address,'127.0.0.1');
    const response=await fetch(new URL('/api/control/workers',url));
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.enabled,true);
    assert.equal(body.read_only,true);
    assert.equal(body.connection.state,'connected');
    assert.deepEqual(body.workers,[worker]);
    const mutation=await fetch(new URL('/api/control/workers',url),{method:'POST'});
    assert.equal(mutation.status,405);
    assert.equal((await mutation.json()).code,'read_only');
  });
});

test('interface translates telemetry failures without returning thrown diagnostics',async()=>{
  await withInterface({enabled:true,adapter:{list:async()=>{throw Object.assign(new Error('PRIVATE_SECRET_MARKER'),{code:'server_not_running'});}}},async({url})=>{
    const response=await fetch(new URL('/api/control/workers',url));
    assert.equal(response.status,503);
    const text=await response.text();
    assert.match(text,/could not read local worker activity/);
    assert.match(text,/server_not_running/);
    assert.doesNotMatch(text,/PRIVATE_SECRET_MARKER/);
  });
});

test('loopback server serves the existing control page and labels canonical state unavailable',async()=>{
  await withInterface({},async({url})=>{
    const page=await fetch(url);
    assert.equal(page.status,200);
    assert.match(await page.text(),/What’s moving now/);
    const state=await fetch(new URL('/api/control/state',url));
    assert.equal(state.status,503);
    assert.equal((await state.json()).code,'local_worker_view_only');
  });
});
