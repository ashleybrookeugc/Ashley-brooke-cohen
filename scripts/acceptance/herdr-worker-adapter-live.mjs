import {execFile,spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {promisify} from 'node:util';
import {createHerdrWorkerAdapter,sha256File} from '../../src/local-workers/herdr-adapter.js';

const execFileAsync=promisify(execFile);

const required=['HERDR_BIN','CODEX_BIN','CODEX_CONFIG','TRUSTED_CODEX_CONFIG_SHA256','PROJECT_TRUTH_COMMIT'];
for(const name of required) if(!process.env[name]) throw new Error(`Missing ${name}`);

const root=await mkdtemp('/private/tmp/mk-herdr-adapter-live-');
const workspace=path.join(root,'workspace');
const xdgConfig=path.join(root,'xdg-config');
const xdgState=path.join(root,'xdg-state');
const xdgRuntime=path.join(root,'xdg-runtime');
await mkdir(workspace);
await mkdir(path.join(xdgConfig,'herdr'),{recursive:true});
await mkdir(xdgState,{recursive:true});
await mkdir(xdgRuntime,{recursive:true});
await writeFile(path.join(xdgConfig,'herdr','config.toml'),'onboarding = false\n');
const session='mk-adapter-'+path.basename(root).slice(-8).replace(/[^a-z0-9]/g,'');
const startedAt=new Date().toISOString();
const serverEnv={HOME:process.env.HOME,PATH:path.dirname(process.env.CODEX_BIN)+':/usr/bin:/bin:/usr/sbin:/sbin',TERM:'xterm-256color',TMPDIR:process.env.TMPDIR||'/private/tmp',XDG_CONFIG_HOME:xdgConfig,XDG_STATE_HOME:xdgState,XDG_RUNTIME_DIR:xdgRuntime,HERDR_SESSION:session,HERDR_DISABLE_SOUND:'1',SHELL:'/bin/zsh'};
const adapter=createHerdrWorkerAdapter({
  enabled:true,
  herdrPath:process.env.HERDR_BIN,
  codexPath:process.env.CODEX_BIN,
  codexConfigPath:process.env.CODEX_CONFIG,
  trustedConfigSha256:process.env.TRUSTED_CODEX_CONFIG_SHA256,
  sessionName:session,
  xdgConfigHome:xdgConfig,
  xdgStateHome:xdgState,
  xdgRuntimeDir:xdgRuntime,
  isolationRoot:root,
});
const authorization={
  authorized:true,
  test_only:true,
  task_id:'herdr-live-acceptance',
  authority:{repo:'ashleybrookeugc/research-vault',path:'research/ai-workflows/2026-10-09-hermes-herdr-live-codex-monitoring.md',sha:process.env.PROJECT_TRUTH_COMMIT},
  filesystem:'read-only',network:'none',github:'none',cloudflare:'none',spending:'none',publishing:'none',deletion:'none',private_data:'none',
};
const receipt={version:'mary-kate.herdr-adapter-live.v1',started_at:startedAt,root,session,authorization,observations:[]};
let worker;
let server;
try {
  server=spawn(process.env.HERDR_BIN,['server'],{env:serverEnv,cwd:root,detached:false,stdio:['ignore','ignore','ignore']});
  const serverDeadline=Date.now()+10000;
  while(true) {
    try { await execFileAsync(process.env.HERDR_BIN,['api','snapshot'],{env:serverEnv,cwd:root,timeout:1000});break; }
    catch(error) { if(Date.now()>=serverDeadline) throw new Error('Herdr headless server did not become ready');await new Promise(resolve=>setTimeout(resolve,100)); }
  }
  receipt.herdr_server='ready';
  receipt.activation=await adapter.activate();
  worker=await adapter.launch({task:{id:'herdr-live-acceptance',summary:'Disposable read-only Herdr/Codex adapter acceptance'},authorization,cwd:workspace,agentName:'mk-v1-test'});
  receipt.worker_identity=worker.identity;
  receipt.observations.push(worker);
  const prompt='You are an authorized disposable read-only acceptance worker. Do not modify files, use network, GitHub, Cloudflare, publishing, spending, deletion, or private-data tools. Run exactly the read-only command `/bin/sleep 5`, then reply exactly `MK_HERDR_ACCEPTANCE_OK`. Do nothing else.';
  receipt.observations.push(await adapter.dispatch(worker.id,prompt));
  const deadline=Date.now()+90000;
  while(Date.now()<deadline) {
    await new Promise(resolve=>setTimeout(resolve,250));
    const observation=await adapter.observe(worker.id);
    receipt.observations.push(observation);
    const states=new Set(receipt.observations.map(item=>item.state));
    if(states.has('running')&&['completed','blocked','disconnected','unknown'].includes(observation.state)) break;
  }
  receipt.states_observed=[...new Set(receipt.observations.map(item=>item.state))];
  receipt.real_activity_observed=receipt.states_observed.includes('running');
  receipt.completion_transition_observed=receipt.states_observed.includes('completed');
  receipt.outcome_verified=false;
  receipt.after_config_sha256=await sha256File(process.env.CODEX_CONFIG);
  receipt.config_unchanged=receipt.after_config_sha256===process.env.TRUSTED_CODEX_CONFIG_SHA256;
  receipt.close=await adapter.close(worker.id);
  receipt.exit_not_running=receipt.close.state==='disconnected';
  receipt.acceptance=receipt.real_activity_observed&&receipt.completion_transition_observed&&receipt.config_unchanged&&receipt.exit_not_running?'PASS':'FAIL';
} catch(error) {
  receipt.acceptance='FAIL';
  receipt.error={code:error.code||'error',message:error.message};
  if(worker?.id) receipt.close=await adapter.close(worker.id).catch(closeError=>({state:'unknown',error:closeError.code||'close_failed'}));
} finally {
  if(server) {
    await execFileAsync(process.env.HERDR_BIN,['server','stop'],{env:serverEnv,cwd:root,timeout:5000}).catch(()=>{});
    await new Promise(resolve=>{if(server.exitCode!=null)return resolve();server.once('exit',resolve);setTimeout(resolve,3000);});
    receipt.herdr_server_after='stopped';
  }
  receipt.finished_at=new Date().toISOString();
  const output=path.join(root,'receipt.json');
  await writeFile(output,JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({acceptance:receipt.acceptance,root,receipt:output,states_observed:receipt.states_observed||[],worker_identity:receipt.worker_identity||null,error:receipt.error||null}));
}

if(receipt.acceptance!=='PASS') process.exitCode=1;
