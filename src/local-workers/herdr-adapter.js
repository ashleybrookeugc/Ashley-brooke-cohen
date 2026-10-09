import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {promisify} from 'node:util';

const execFileAsync=promisify(execFile);

export const HERDR_WORKER_STATES=['running','idle','completed','blocked','disconnected','unknown'];

const DENIED_CAPABILITIES=['github','cloudflare','spending','publishing','deletion','private_data'];
const CODEX_HARDENING_ARGS=[
  '--sandbox','read-only',
  '--ask-for-approval','never',
  '--no-daemon',
  '--no-alt-screen',
  '--strict-config',
  '-c','shell_environment_policy.inherit="none"',
  '-c','mcp_servers={}',
  '-c','apps={}',
  '-c','plugins={}',
  '--disable','apps',
  '--disable','plugins',
  '--disable','computer_use',
  '--disable','browser_use',
  '--disable','browser_use_external',
  '--disable','browser_use_full_cdp_access',
  '--disable','in_app_browser',
  '--disable','image_generation',
  '--disable','multi_agent',
  '--disable','multi_agent_v2',
  '--disable','remote_plugin',
  '--disable','standalone_web_search',
];

export class HerdrAdapterError extends Error {
  constructor(code,message){super(message);this.code=code;}
}

export async function sha256File(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

async function defaultRun(file,args,{env,cwd,timeoutMs=30000}={}) {
  try {
    const result=await execFileAsync(file,args,{env,cwd,timeout:timeoutMs,maxBuffer:2*1024*1024});
    return {status:0,stdout:result.stdout,stderr:result.stderr};
  } catch(error) {
    return {status:Number.isInteger(error.code)?error.code:1,stdout:error.stdout||'',stderr:error.stderr||'',timedOut:Boolean(error.killed)};
  }
}

function parseResponse(result,operation) {
  let response;
  try { response=JSON.parse(result.stdout||result.stderr); }
  catch { throw new HerdrAdapterError('herdr_invalid_response',`Herdr returned no parseable response for ${operation}`); }
  if(result.status!==0||response.error) {
    const code=response?.error?.code||'herdr_command_failed';
    throw new HerdrAdapterError(code,`Herdr could not complete ${operation}`);
  }
  return response.result;
}

function requireString(value,label,pattern) {
  if(typeof value!=='string'||!pattern.test(value)) throw new HerdrAdapterError('invalid_request',`${label} is invalid`);
}

function requireAuthorization(authorization,taskId) {
  if(!authorization||authorization.authorized!==true||authorization.test_only!==true||authorization.task_id!==taskId) {
    throw new HerdrAdapterError('not_authorized','Project Truth authorization is required for this isolated test worker');
  }
  if(authorization.authority?.repo!=='ashleybrookeugc/research-vault'||!/^[-A-Za-z0-9_/.]+$/.test(authorization.authority?.path||'')||!(/^[a-f0-9]{40}$/.test(authorization.authority?.sha||'')||/^[a-f0-9]{64}$/.test(authorization.authority?.sha||''))) {
    throw new HerdrAdapterError('missing_authority_evidence','Authorization must identify its canonical Project Truth evidence');
  }
  if(authorization.filesystem!=='read-only'||authorization.network!=='none') {
    throw new HerdrAdapterError('capability_not_allowed','The V1 adapter permits only read-only, offline test workers');
  }
  for(const capability of DENIED_CAPABILITIES) {
    if(authorization[capability]!=='none') throw new HerdrAdapterError('capability_not_allowed',`${capability} permission is not allowed`);
  }
}

function mapState(agent) {
  if(!agent) return 'disconnected';
  if(agent.agent_status==='working') return 'running';
  if(agent.agent_status==='idle') return agent.completion_seq==null?'idle':'completed';
  if(agent.agent_status==='done') return 'completed';
  if(agent.agent_status==='blocked') return 'blocked';
  return 'unknown';
}

function progressEvent(agent,observedAt) {
  return {
    observed_at:observedAt,
    source:'herdr',
    source_status:agent?.agent_status||'absent',
    state:mapState(agent),
    state_change_seq:Number.isInteger(agent?.state_change_seq)?agent.state_change_seq:null,
    completion_seq:Number.isInteger(agent?.completion_seq)?agent.completion_seq:null,
    revision:Number.isInteger(agent?.revision)?agent.revision:null,
  };
}

function safeWorker(worker,agent,observedAt) {
  const state=mapState(agent);
  const latest=progressEvent(agent,observedAt);
  const previous=worker.progress_events.at(-1);
  if(!previous||JSON.stringify({...previous,observed_at:null})!==JSON.stringify({...latest,observed_at:null})) worker.progress_events.push(latest);
  worker.last_observed_at=observedAt;
  worker.state=state;
  return {
    id:worker.id,
    task:{id:worker.task.id,summary:worker.task.summary},
    state,
    state_source:'herdr',
    outcome_verified:false,
    runtime_metrics:{model:null,tokens:null,cost:null},
    last_observed_at:observedAt,
    progress_events:structuredClone(worker.progress_events),
    identity:{session:worker.session,workspace_id:worker.workspace_id,pane_id:worker.pane_id,agent_name:worker.agent_name},
  };
}

function unavailableWorker(worker,error,observedAt) {
  const code=typeof error?.code==='string'&&/^[a-z0-9_]{1,64}$/.test(error.code)?error.code:'observation_failed';
  const latest={observed_at:observedAt,source:'herdr',source_status:'telemetry_unavailable',state:'unknown',state_change_seq:null,completion_seq:null,revision:null};
  const previous=worker.progress_events.at(-1);
  if(!previous||JSON.stringify({...previous,observed_at:null})!==JSON.stringify({...latest,observed_at:null})) worker.progress_events.push(latest);
  worker.last_observed_at=observedAt;
  worker.state='unknown';
  return {
    id:worker.id,
    task:{id:worker.task.id,summary:worker.task.summary},
    state:'unknown',
    state_source:'herdr',
    outcome_verified:false,
    runtime_metrics:{model:null,tokens:null,cost:null},
    last_observed_at:observedAt,
    progress_events:structuredClone(worker.progress_events),
    identity:{session:worker.session,workspace_id:worker.workspace_id,pane_id:worker.pane_id,agent_name:worker.agent_name},
    telemetry:{status:'unavailable',message:'Worker telemetry is temporarily unavailable.',diagnostic_code:code},
  };
}

export function createHerdrWorkerAdapter({
  enabled=false,
  herdrPath,
  codexPath,
  codexConfigPath,
  trustedConfigSha256,
  sessionName='mary-kate-v1',
  xdgConfigHome,
  xdgStateHome,
  xdgRuntimeDir,
  isolationRoot,
  run=defaultRun,
  now=()=>new Date().toISOString(),
  baseEnv=process.env,
}={}) {
  let active=false;
  const workers=new Map();
  const safeEnv=Object.fromEntries(Object.entries({
    HOME:baseEnv.HOME,
    PATH:(codexPath?path.dirname(codexPath)+':':'')+'/usr/bin:/bin:/usr/sbin:/sbin',
    TERM:'xterm-256color',
    TMPDIR:baseEnv.TMPDIR||'/private/tmp',
    XDG_CONFIG_HOME:xdgConfigHome,
    XDG_STATE_HOME:xdgStateHome,
    XDG_RUNTIME_DIR:xdgRuntimeDir,
    HERDR_SESSION:sessionName,
    HERDR_DISABLE_SOUND:'1',
    SHELL:'/bin/zsh',
  }).filter(([,value])=>typeof value==='string'&&value.length));

  async function verifyConfiguration() {
    if(!/^[a-f0-9]{64}$/.test(trustedConfigSha256||'')) throw new HerdrAdapterError('missing_trusted_baseline','A trusted Codex configuration baseline is required');
    let actual;
    try { actual=await sha256File(codexConfigPath); }
    catch { throw new HerdrAdapterError('missing_codex_config','The Codex configuration could not be read'); }
    if(actual!==trustedConfigSha256) throw new HerdrAdapterError('codex_config_changed','Codex configuration differs from the trusted baseline');
    return {trusted_sha256:trustedConfigSha256,actual_sha256:actual,status:'matched'};
  }

  async function command(args,operation,timeoutMs) {
    const result=await run(herdrPath,args,{env:safeEnv,cwd:isolationRoot,timeoutMs});
    return parseResponse(result,operation);
  }

  return {
    get active(){return active;},
    async activate() {
      if(enabled!==true) throw new HerdrAdapterError('adapter_disabled','The Herdr adapter is disabled');
      for(const [label,value] of Object.entries({herdrPath,codexPath,codexConfigPath,isolationRoot,xdgConfigHome,xdgStateHome,xdgRuntimeDir})) {
        if(typeof value!=='string'||!path.isAbsolute(value)) throw new HerdrAdapterError('invalid_configuration',`${label} must be an absolute path`);
      }
      const configuration=await verifyConfiguration();
      active=true;
      return {active:true,configuration};
    },
    async launch({task,authorization,cwd,agentName}) {
      if(!active) throw new HerdrAdapterError('adapter_inactive','The Herdr adapter has not been activated');
      requireString(task?.id,'task.id',/^[a-z][a-z0-9_-]{0,63}$/);
      requireString(task?.summary,'task.summary',/^.{1,240}$/s);
      requireString(agentName,'agentName',/^[a-z][a-z0-9_-]{0,31}$/);
      requireAuthorization(authorization,task.id);
      await verifyConfiguration();
      const root=await realpath(isolationRoot),resolved=await realpath(cwd);
      if(resolved!==root&&!resolved.startsWith(root+path.sep)) throw new HerdrAdapterError('isolation_required','Worker cwd must stay inside the configured isolation root');
      const created=await command(['workspace','create','--cwd',resolved,'--label',task.id,'--no-focus'],'workspace creation');
      const workspaceId=created?.workspace?.workspace_id;
      const paneId=created?.root_pane?.pane_id;
      if(!workspaceId||!paneId) throw new HerdrAdapterError('herdr_invalid_response','Herdr did not return stable workspace and pane identities');
      try {
        const started=await command(['agent','start',agentName,'--kind','codex','--pane',paneId,'--timeout','120000','--',...CODEX_HARDENING_ARGS,'-C',resolved],'agent start',130000);
        const agent=started?.agent;
        const worker={id:`herdr:${sessionName}:${workspaceId}:${agentName}`,session:sessionName,workspace_id:workspaceId,pane_id:paneId,agent_name:agentName,task:{id:task.id,summary:task.summary},progress_events:[],state:'unknown',last_observed_at:null};
        workers.set(worker.id,worker);
        return safeWorker(worker,agent,now());
      } catch(error) {
        await command(['workspace','close',workspaceId],'failed worker cleanup').catch(()=>{});
        throw error;
      }
    },
    async dispatch(workerId,prompt,{wait=false,timeoutMs=120000}={}) {
      const worker=workers.get(workerId);
      if(!worker) throw new HerdrAdapterError('worker_not_found','Worker is not managed by this adapter');
      if(typeof prompt!=='string'||!prompt.trim()||prompt.length>4000) throw new HerdrAdapterError('invalid_request','Prompt is invalid');
      await verifyConfiguration();
      const args=['agent','prompt',worker.agent_name,prompt];
      if(wait) args.push('--wait','--timeout',String(timeoutMs));
      const result=await command(args,'agent prompt',timeoutMs+10000);
      return safeWorker(worker,result?.agent,now());
    },
    async observe(workerId) {
      const worker=workers.get(workerId);
      if(!worker) throw new HerdrAdapterError('worker_not_found','Worker is not managed by this adapter');
      try {
        const result=await command(['agent','get',worker.agent_name],'agent observation');
        return safeWorker(worker,result?.agent,now());
      } catch(error) {
        if(['agent_not_found','target_not_found','herdr_command_failed'].includes(error.code)) return safeWorker(worker,null,now());
        throw error;
      }
    },
    async list() {
      if(!active) throw new HerdrAdapterError('adapter_inactive','The Herdr adapter has not been activated');
      const snapshots=[];
      for(const worker of workers.values()) {
        try { snapshots.push(await this.observe(worker.id)); }
        catch(error) { snapshots.push(unavailableWorker(worker,error,now())); }
      }
      return snapshots;
    },
    async close(workerId) {
      const worker=workers.get(workerId);
      if(!worker) throw new HerdrAdapterError('worker_not_found','Worker is not managed by this adapter');
      await command(['workspace','close',worker.workspace_id],'workspace close');
      return safeWorker(worker,null,now());
    },
  };
}
