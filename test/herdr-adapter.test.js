import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHerdrWorkerAdapter,HerdrAdapterError,sha256File} from '../src/local-workers/herdr-adapter.js';

const authority={repo:'ashleybrookeugc/research-vault',path:'ACTIVE_WORK.md',sha:'a'.repeat(40)};
const allowed={authorized:true,test_only:true,task_id:'worker-test',authority,filesystem:'read-only',network:'none',github:'none',cloudflare:'none',spending:'none',publishing:'none',deletion:'none',private_data:'none'};

async function fixture(overrides={}) {
  const root=await mkdtemp(path.join(os.tmpdir(),'mk-herdr-adapter-test-'));
  const cwd=path.join(root,'worker');await mkdir(cwd);
  const config=path.join(root,'config.toml');await writeFile(config,'approval_policy = "never"\n');
  const hash=await sha256File(config);
  const calls=[];
  const states=[
    {agent_status:'idle',state_change_seq:1,revision:1},
    {agent_status:'working',state_change_seq:2,revision:2},
    {agent_status:'idle',state_change_seq:3,completion_seq:3,revision:3},
  ];
  const observedStates=[states[0],states[2]];
  const run=async(_file,args,options)=>{
    calls.push({args,options});
    if(args[0]==='workspace'&&args[1]==='create') return {status:0,stdout:JSON.stringify({result:{workspace:{workspace_id:'w1'},root_pane:{pane_id:'w1:p1'}}}),stderr:''};
    if(args[0]==='workspace'&&args[1]==='close') return {status:0,stdout:JSON.stringify({result:{closed:true}}),stderr:''};
    if(args[0]==='agent'&&args[1]==='start') return {status:0,stdout:JSON.stringify({result:{agent:{name:'mk-worker',workspace_id:'w1',pane_id:'w1:p1',...states[0]}}}),stderr:''};
    if(args[0]==='agent'&&args[1]==='prompt') return {status:0,stdout:JSON.stringify({result:{agent:{name:'mk-worker',workspace_id:'w1',pane_id:'w1:p1',...states[1]}}}),stderr:''};
    if(args[0]==='agent'&&args[1]==='get') return {status:0,stdout:JSON.stringify({result:{agent:{name:'mk-worker',workspace_id:'w1',pane_id:'w1:p1',...observedStates.shift()}}}),stderr:''};
    throw new Error('unexpected command '+args.join(' '));
  };
  return {root,cwd,config,hash,calls,run,adapter:createHerdrWorkerAdapter({enabled:true,herdrPath:'/test/herdr',codexPath:'/test/codex',codexConfigPath:config,trustedConfigSha256:hash,sessionName:'test-session',xdgConfigHome:path.join(root,'xdg-config'),xdgStateHome:path.join(root,'xdg-state'),xdgRuntimeDir:path.join(root,'xdg-runtime'),isolationRoot:root,run,baseEnv:{HOME:'/test/home',TMPDIR:root,GITHUB_TOKEN:'no',CLOUDFLARE_API_TOKEN:'no',OPENAI_API_KEY:'no',UNRELATED_SECRET:'no'},now:(()=>{let n=0;return()=>`2026-10-09T00:00:0${n++}.000Z`;})(),...overrides})};
}

test('adapter is disabled by default',async()=>{
  const defaultAdapter=createHerdrWorkerAdapter();
  await assert.rejects(defaultAdapter.activate(),error=>error.code==='adapter_disabled');
  const f=await fixture({enabled:false});
  await assert.rejects(f.adapter.activate(),error=>error instanceof HerdrAdapterError&&error.code==='adapter_disabled');
  assert.equal(f.calls.length,0);
});

test('activation fails closed for missing or changed Codex configuration baseline',async()=>{
  const missing=await fixture({trustedConfigSha256:undefined});
  await assert.rejects(missing.adapter.activate(),error=>error.code==='missing_trusted_baseline');
  const changed=await fixture({trustedConfigSha256:'0'.repeat(64)});
  await assert.rejects(changed.adapter.activate(),error=>error.code==='codex_config_changed');
  assert.equal(missing.calls.length+changed.calls.length,0);
});

test('configuration drift after activation blocks launch before Herdr is called',async()=>{
  const f=await fixture();await f.adapter.activate();
  await writeFile(f.config,'approval_policy = "on-request"\n');
  await assert.rejects(f.adapter.launch({task:{id:'worker-test',summary:'Do not launch'},authorization:allowed,cwd:f.cwd,agentName:'mk-worker'}),error=>error.code==='codex_config_changed');
  assert.equal(f.calls.length,0);
});

test('authorized worker uses isolated Herdr identity and fixed deny-by-default Codex controls',async()=>{
  const f=await fixture();await f.adapter.activate();
  const worker=await f.adapter.launch({task:{id:'worker-test',summary:'Disposable read-only worker'},authorization:allowed,cwd:f.cwd,agentName:'mk-worker'});
  assert.equal(worker.id,'herdr:test-session:w1:mk-worker');
  assert.equal(worker.state,'idle');
  assert.deepEqual(worker.identity,{session:'test-session',workspace_id:'w1',pane_id:'w1:p1',agent_name:'mk-worker'});
  const start=f.calls.find(call=>call.args[0]==='agent'&&call.args[1]==='start');
  assert.ok(start.args.includes('read-only'));
  assert.ok(start.args.includes('never'));
  assert.ok(start.args.includes('mcp_servers={}'));
  assert.ok(start.args.includes('apps={}'));
  assert.ok(start.args.includes('plugins={}'));
  assert.equal(start.options.env.GITHUB_TOKEN,undefined);
  assert.equal(start.options.env.CLOUDFLARE_API_TOKEN,undefined);
  assert.equal(start.options.env.OPENAI_API_KEY,undefined);
  assert.equal(start.options.env.UNRELATED_SECRET,undefined);
});

test('authorization does not inherit broader execution permissions',async()=>{
  const f=await fixture();await f.adapter.activate();
  for(const key of ['github','cloudflare','spending','publishing','deletion','private_data']) {
    await assert.rejects(f.adapter.launch({task:{id:'worker-test',summary:'No escalation'},authorization:{...allowed,[key]:'write'},cwd:f.cwd,agentName:'mk-worker'}),error=>error.code==='capability_not_allowed');
  }
  assert.equal(f.calls.length,0);
});

test('authorization must point to canonical Project Truth evidence',async()=>{
  const f=await fixture();await f.adapter.activate();
  await assert.rejects(f.adapter.launch({task:{id:'worker-test',summary:'Reject false authority'},authorization:{...allowed,authority:{...authority,repo:'example/not-project-truth'}},cwd:f.cwd,agentName:'mk-worker'}),error=>error.code==='missing_authority_evidence');
  assert.equal(f.calls.length,0);
});

test('activity, completion, and disconnection are sourced from Herdr without a false running state',async()=>{
  const f=await fixture();await f.adapter.activate();
  const launched=await f.adapter.launch({task:{id:'worker-test',summary:'Observe states'},authorization:allowed,cwd:f.cwd,agentName:'mk-worker'});
  const running=await f.adapter.dispatch(launched.id,'Return a harmless marker.');
  assert.equal(running.state,'running');
  const idle=await f.adapter.observe(launched.id);assert.equal(idle.state,'idle');
  const completed=await f.adapter.observe(launched.id);assert.equal(completed.state,'completed');
  const closed=await f.adapter.close(launched.id);assert.equal(closed.state,'disconnected');
  assert.equal(completed.outcome_verified,false);
  assert.deepEqual(completed.progress_events.map(event=>event.state),['idle','running','idle','completed']);
});

test('unknown and blocked Herdr states stay distinct',async()=>{
  let index=0;
  const states=['blocked','unknown'];
  const f=await fixture({run:async(_file,args)=>{
    if(args[0]==='workspace') return {status:0,stdout:JSON.stringify({result:args[1]==='create'?{workspace:{workspace_id:'w1'},root_pane:{pane_id:'w1:p1'}}:{closed:true}}),stderr:''};
    const status=args[1]==='start'?'idle':states[index++];
    return {status:0,stdout:JSON.stringify({result:{agent:{name:'mk-worker',workspace_id:'w1',pane_id:'w1:p1',agent_status:status,state_change_seq:index,revision:index}}}),stderr:''};
  }});
  await f.adapter.activate();
  const worker=await f.adapter.launch({task:{id:'worker-test',summary:'Observe uncertain states'},authorization:allowed,cwd:f.cwd,agentName:'mk-worker'});
  assert.equal((await f.adapter.observe(worker.id)).state,'blocked');
  assert.equal((await f.adapter.observe(worker.id)).state,'unknown');
});

test('read-only worker inventory returns managed snapshots without claiming metrics or verification',async()=>{
  const f=await fixture();await f.adapter.activate();
  await f.adapter.launch({task:{id:'worker-test',summary:'Inventory worker'},authorization:allowed,cwd:f.cwd,agentName:'mk-worker'});
  const [worker]=await f.adapter.list();
  assert.equal(worker.state,'idle');
  assert.equal(worker.outcome_verified,false);
  assert.deepEqual(worker.runtime_metrics,{model:null,tokens:null,cost:null});
});

test('inventory reports unavailable telemetry as unknown rather than active',async()=>{
  const f=await fixture({run:async(_file,args)=>{
    if(args[0]==='workspace'&&args[1]==='create') return {status:0,stdout:JSON.stringify({result:{workspace:{workspace_id:'w1'},root_pane:{pane_id:'w1:p1'}}}),stderr:''};
    if(args[0]==='agent'&&args[1]==='start') return {status:0,stdout:JSON.stringify({result:{agent:{agent_status:'idle',state_change_seq:1,revision:1}}}),stderr:''};
    if(args[0]==='agent'&&args[1]==='get') return {status:1,stdout:JSON.stringify({error:{code:'server_not_running'}}),stderr:''};
    throw new Error('unexpected command');
  }});
  await f.adapter.activate();
  await f.adapter.launch({task:{id:'worker-test',summary:'Unavailable worker'},authorization:allowed,cwd:f.cwd,agentName:'mk-worker'});
  const [worker]=await f.adapter.list();
  assert.equal(worker.state,'unknown');
  assert.equal(worker.telemetry.status,'unavailable');
  assert.equal(worker.telemetry.diagnostic_code,'server_not_running');
});
