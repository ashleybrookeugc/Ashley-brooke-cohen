import {execFile,spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {promisify} from 'node:util';
import {createHerdrWorkerAdapter,sha256File} from '../../src/local-workers/herdr-adapter.js';
import {createCloudflareWorkerTelemetryPublisher} from '../../src/local-workers/cloudflare-telemetry.js';

const execFileAsync=promisify(execFile);
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const required=['HERDR_BIN','CODEX_BIN','CODEX_CONFIG','TRUSTED_CODEX_CONFIG_SHA256','PROJECT_TRUTH_COMMIT','MK_WORKER_TELEMETRY_SECRET','TELEMETRY_ENDPOINT'];
for(const name of required) if(!process.env[name]) throw new Error(`Missing ${name}`);

async function codexPids() {
  try { const {stdout}=await execFileAsync('/usr/bin/pgrep',['-f','codex'],{timeout:2000});return stdout.trim().split(/\s+/).filter(Boolean).map(Number).filter(Number.isInteger).sort((a,b)=>a-b); }
  catch { return []; }
}

const root=await mkdtemp('/private/tmp/mk-hcf-');
const workspace=path.join(root,'w'),xdgConfig=path.join(root,'c'),xdgState=path.join(root,'s'),xdgRuntime=path.join(root,'r');
await mkdir(workspace);await mkdir(path.join(xdgConfig,'herdr'),{recursive:true});await mkdir(xdgState,{recursive:true});await mkdir(xdgRuntime,{recursive:true});
await writeFile(path.join(xdgConfig,'herdr','config.toml'),'onboarding = false\n');
const session='mk-cloud-'+path.basename(root).slice(-6).toLowerCase().replace(/[^a-z0-9]/g,'');
const serverEnv={HOME:process.env.HOME,PATH:path.dirname(process.env.CODEX_BIN)+':/usr/bin:/bin:/usr/sbin:/sbin',TERM:'xterm-256color',TMPDIR:process.env.TMPDIR||'/private/tmp',XDG_CONFIG_HOME:xdgConfig,XDG_STATE_HOME:xdgState,XDG_RUNTIME_DIR:xdgRuntime,HERDR_SESSION:session,HERDR_DISABLE_SOUND:'1',SHELL:'/bin/zsh'};
const adapter=createHerdrWorkerAdapter({enabled:true,herdrPath:process.env.HERDR_BIN,codexPath:process.env.CODEX_BIN,codexConfigPath:process.env.CODEX_CONFIG,trustedConfigSha256:process.env.TRUSTED_CODEX_CONFIG_SHA256,sessionName:session,xdgConfigHome:xdgConfig,xdgStateHome:xdgState,xdgRuntimeDir:xdgRuntime,isolationRoot:root});
const publisher=createCloudflareWorkerTelemetryPublisher({enabled:true,endpoint:process.env.TELEMETRY_ENDPOINT,secretProvider:async()=>process.env.MK_WORKER_TELEMETRY_SECRET});
const authorization={authorized:true,test_only:true,task_id:'herdr-cloudflare-acceptance',authority:{repo:'ashleybrookeugc/research-vault',path:'shared-capabilities/ai-workflows/LEARNED_CHANGE_LOG.md',sha:process.env.PROJECT_TRUTH_COMMIT},filesystem:'read-only',network:'none',github:'none',cloudflare:'none',spending:'none',publishing:'none',deletion:'none',private_data:'none'};
const receipt={version:'mary-kate.herdr-cloudflare-live.v1',started_at:new Date().toISOString(),root,session,authorization,states_published:[],external_codex_pids_before:await codexPids()};
let server,worker;
const publish=async()=>{
  const workers=await adapter.list();
  const envelope={version:'mary-kate.local-workers.v1',enabled:true,read_only:true,observed_at:new Date().toISOString(),configuration_integrity:'matched',workers};
  await publisher.publish(envelope);
  const state=workers[0]?.state||'none';
  if(receipt.states_published.at(-1)!==state) receipt.states_published.push(state);
  console.log(JSON.stringify({event:'telemetry_published',state,worker_id:workers[0]?.id||null}));
  return workers[0];
};

try {
  server=spawn(process.env.HERDR_BIN,['server'],{env:serverEnv,cwd:root,detached:false,stdio:['ignore','ignore','ignore']});
  const readyBy=Date.now()+10000;
  while(true){try{await execFileAsync(process.env.HERDR_BIN,['api','snapshot'],{env:serverEnv,cwd:root,timeout:1000});break;}catch{if(Date.now()>=readyBy)throw new Error('Herdr headless server did not become ready');await sleep(100);}}
  receipt.activation=await adapter.activate();
  worker=await adapter.launch({task:{id:'herdr-cloudflare-acceptance',summary:'Read-only Cloudflare worker display acceptance'},authorization,cwd:workspace,agentName:'mk-cloud-test'});
  receipt.worker_identity=worker.identity;
  await publish();
  await sleep(10000);
  await adapter.dispatch(worker.id,'You are an authorized disposable read-only Cloudflare display acceptance worker. Do not modify files or use network, GitHub, Cloudflare, publishing, spending, deletion, or private-data tools. Run exactly `/bin/sleep 20`, then reply exactly `MK_HERDR_CLOUDFLARE_OK`. Do nothing else.');
  const completeBy=Date.now()+90000;
  while(Date.now()<completeBy){await sleep(3000);const observation=await publish();if(['completed','blocked','disconnected','unknown'].includes(observation.state))break;}
  if(receipt.states_published.at(-1)!=='completed') throw new Error(`Worker did not complete: ${receipt.states_published.at(-1)}`);
  await sleep(10000);
  receipt.close=await adapter.close(worker.id);
  await publish();
  await sleep(25000);
  receipt.config_after_sha256=await sha256File(process.env.CODEX_CONFIG);
  receipt.config_unchanged=receipt.config_after_sha256===process.env.TRUSTED_CODEX_CONFIG_SHA256;
  receipt.external_codex_pids_after=await codexPids();
  receipt.external_codex_pids_survived=receipt.external_codex_pids_before.every(pid=>receipt.external_codex_pids_after.includes(pid));
  receipt.acceptance=receipt.config_unchanged&&receipt.external_codex_pids_survived&&['idle','running','completed','disconnected'].every(state=>receipt.states_published.includes(state))?'PASS':'FAIL';
} catch(error) {
  receipt.acceptance='FAIL';receipt.error={code:error.code||'error',message:error.message};
} finally {
  if(worker?.id&&receipt.close?.state!=='disconnected') receipt.close=await adapter.close(worker.id).catch(error=>({state:'unknown',error:error.code||'close_failed'}));
  if(server){await execFileAsync(process.env.HERDR_BIN,['server','stop'],{env:serverEnv,cwd:root,timeout:5000}).catch(()=>{});await new Promise(resolve=>{if(server.exitCode!=null)return resolve();server.once('exit',resolve);setTimeout(resolve,3000);});}
  receipt.finished_at=new Date().toISOString();
  const output=path.join(root,'receipt.json');await writeFile(output,JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({event:'acceptance_finished',acceptance:receipt.acceptance,receipt:output,states_published:receipt.states_published,error:receipt.error||null}));
}
if(receipt.acceptance!=='PASS') process.exitCode=1;
