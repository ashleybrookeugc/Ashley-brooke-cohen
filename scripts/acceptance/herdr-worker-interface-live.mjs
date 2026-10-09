import {execFile,spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {promisify} from 'node:util';
import {createHerdrWorkerAdapter,sha256File} from '../../src/local-workers/herdr-adapter.js';
import {createLocalWorkerControlInterface} from '../../src/local-workers/control-interface.js';

const execFileAsync=promisify(execFile);
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const required=['HERDR_BIN','CODEX_BIN','CODEX_CONFIG','TRUSTED_CODEX_CONFIG_SHA256','PROJECT_TRUTH_COMMIT'];
for(const name of required) if(!process.env[name]) throw new Error(`Missing ${name}`);

async function codexPids() {
  try {
    const {stdout}=await execFileAsync('/usr/bin/pgrep',['-f','codex'],{timeout:2000});
    return stdout.trim().split(/\s+/).filter(Boolean).map(Number).filter(Number.isInteger).sort((a,b)=>a-b);
  } catch { return []; }
}

const root=await mkdtemp('/private/tmp/mk-hui-');
const workspace=path.join(root,'w');
const xdgConfig=path.join(root,'c');
const xdgState=path.join(root,'s');
const xdgRuntime=path.join(root,'r');
await mkdir(workspace);
await mkdir(path.join(xdgConfig,'herdr'),{recursive:true});
await mkdir(xdgState,{recursive:true});
await mkdir(xdgRuntime,{recursive:true});
await writeFile(path.join(xdgConfig,'herdr','config.toml'),'onboarding = false\n');
const session='mk-ui-'+path.basename(root).slice(-6).toLowerCase().replace(/[^a-z0-9]/g,'');
const serverEnv={HOME:process.env.HOME,PATH:path.dirname(process.env.CODEX_BIN)+':/usr/bin:/bin:/usr/sbin:/sbin',TERM:'xterm-256color',TMPDIR:process.env.TMPDIR||'/private/tmp',XDG_CONFIG_HOME:xdgConfig,XDG_STATE_HOME:xdgState,XDG_RUNTIME_DIR:xdgRuntime,HERDR_SESSION:session,HERDR_DISABLE_SOUND:'1',SHELL:'/bin/zsh'};
const adapter=createHerdrWorkerAdapter({enabled:true,herdrPath:process.env.HERDR_BIN,codexPath:process.env.CODEX_BIN,codexConfigPath:process.env.CODEX_CONFIG,trustedConfigSha256:process.env.TRUSTED_CODEX_CONFIG_SHA256,sessionName:session,xdgConfigHome:xdgConfig,xdgStateHome:xdgState,xdgRuntimeDir:xdgRuntime,isolationRoot:root});
const authorization={authorized:true,test_only:true,task_id:'herdr-interface-acceptance',authority:{repo:'ashleybrookeugc/research-vault',path:'research/ai-workflows/2026-10-09-hermes-herdr-live-codex-monitoring.md',sha:process.env.PROJECT_TRUTH_COMMIT},filesystem:'read-only',network:'none',github:'none',cloudflare:'none',spending:'none',publishing:'none',deletion:'none',private_data:'none'};
const receipt={version:'mary-kate.herdr-interface-live.v1',started_at:new Date().toISOString(),root,session,authorization,interface_snapshots:[],adapter_observations:[],external_codex_pids_before:await codexPids()};
const view=createLocalWorkerControlInterface({enabled:true,adapter,onSnapshot:snapshot=>{const state=snapshot.workers[0]?.state||'none';const last=receipt.interface_snapshots.at(-1);if(last?.workers?.[0]?.state!==state) receipt.interface_snapshots.push(snapshot);}});
let server;
let worker;
try {
  server=spawn(process.env.HERDR_BIN,['server'],{env:serverEnv,cwd:root,detached:false,stdio:['ignore','ignore','ignore']});
  const deadline=Date.now()+10000;
  while(true) {
    try { await execFileAsync(process.env.HERDR_BIN,['api','snapshot'],{env:serverEnv,cwd:root,timeout:1000});break; }
    catch { if(Date.now()>=deadline) throw new Error('Herdr headless server did not become ready');await sleep(100); }
  }
  receipt.activation=await adapter.activate();
  worker=await adapter.launch({task:{id:'herdr-interface-acceptance',summary:'Read-only local worker display acceptance'},authorization,cwd:workspace,agentName:'mk-ui-test'});
  receipt.adapter_observations.push(worker);
  receipt.interface=await view.start();
  console.log(JSON.stringify({event:'interface_ready',url:receipt.interface.url,root,worker_id:worker.id,identity:worker.identity}));
  await sleep(12000);
  const prompt='You are an authorized disposable read-only interface acceptance worker. Do not modify files or use network, GitHub, Cloudflare, publishing, spending, deletion, or private-data tools. Run exactly `/bin/sleep 25`, then reply exactly `MK_HERDR_INTERFACE_OK`. Do nothing else.';
  receipt.adapter_observations.push(await adapter.dispatch(worker.id,prompt));
  console.log(JSON.stringify({event:'worker_dispatched',worker_id:worker.id}));
  const completionDeadline=Date.now()+90000;
  while(Date.now()<completionDeadline) {
    await sleep(500);
    const observation=await adapter.observe(worker.id);
    receipt.adapter_observations.push(observation);
    if(['completed','blocked','disconnected','unknown'].includes(observation.state)) break;
  }
  const final=receipt.adapter_observations.at(-1);
  if(final.state!=='completed') throw new Error(`Worker did not complete: ${final.state}`);
  console.log(JSON.stringify({event:'worker_completed',worker_id:worker.id}));
  await sleep(18000);
  receipt.close=await adapter.close(worker.id);
  console.log(JSON.stringify({event:'worker_disconnected',worker_id:worker.id}));
  await sleep(18000);
  receipt.config_after_sha256=await sha256File(process.env.CODEX_CONFIG);
  receipt.config_unchanged=receipt.config_after_sha256===process.env.TRUSTED_CODEX_CONFIG_SHA256;
  receipt.external_codex_pids_after=await codexPids();
  receipt.external_codex_pids_survived=receipt.external_codex_pids_before.every(pid=>receipt.external_codex_pids_after.includes(pid));
  receipt.states_delivered_to_interface=[...new Set(receipt.interface_snapshots.flatMap(snapshot=>snapshot.workers.map(item=>item.state)))];
  receipt.all_snapshots_keep_outcome_unverified=receipt.interface_snapshots.every(snapshot=>snapshot.workers.every(item=>item.outcome_verified===false));
  receipt.metrics_unavailable=receipt.interface_snapshots.every(snapshot=>snapshot.workers.every(item=>Object.values(item.runtime_metrics||{}).every(value=>value==null)));
  receipt.acceptance=receipt.config_unchanged&&receipt.external_codex_pids_survived&&['idle','running','completed','disconnected'].every(state=>receipt.states_delivered_to_interface.includes(state))&&receipt.all_snapshots_keep_outcome_unverified&&receipt.metrics_unavailable?'PASS':'FAIL';
} catch(error) {
  receipt.acceptance='FAIL';
  receipt.error={code:error.code||'error',message:error.message};
} finally {
  await view.stop().catch(()=>{});
  if(worker?.id&&receipt.close?.state!=='disconnected') receipt.close=await adapter.close(worker.id).catch(error=>({state:'unknown',error:error.code||'close_failed'}));
  if(server) {
    await execFileAsync(process.env.HERDR_BIN,['server','stop'],{env:serverEnv,cwd:root,timeout:5000}).catch(()=>{});
    await new Promise(resolve=>{if(server.exitCode!=null)return resolve();server.once('exit',resolve);setTimeout(resolve,3000);});
  }
  receipt.finished_at=new Date().toISOString();
  const output=path.join(root,'receipt.json');
  await writeFile(output,JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({event:'acceptance_finished',acceptance:receipt.acceptance,receipt:output,states_delivered_to_interface:receipt.states_delivered_to_interface||[],error:receipt.error||null}));
}

if(receipt.acceptance!=='PASS') process.exitCode=1;
