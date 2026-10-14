import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {evaluateExistingNodePolicy,enforceExistingNodePolicy} from './existing-node-policy.mjs';

const cases=JSON.parse(await readFile(new URL('./enforcement-cases.json',import.meta.url),'utf8'));
const opa=process.env.OPA_BIN;
if(!opa) throw new Error('OPA_BIN is required');

const query='[{"id": c.id, "decision": d} | some c in input; d := data.mary_kate.enforcement.decision with input as c]';
const started=performance.now();
const evaluated=spawnSync(opa,['eval','--format=json','--data',new URL('./mary_kate_policy.rego',import.meta.url).pathname,'--stdin-input',query],{input:JSON.stringify(cases),encoding:'utf8'});
const opaDurationMs=performance.now()-started;
if(evaluated.status!==0) throw new Error(evaluated.stderr||evaluated.stdout);
const opaRows=JSON.parse(evaluated.stdout).result[0].expressions[0].value;
const opaById=new Map(opaRows.map(row=>[row.id,row.decision]));

const rows=[];
for(const entry of cases) {
  const nodeStarted=performance.now();
  const nodeDecision=evaluateExistingNodePolicy(entry);
  const nodeDurationMs=performance.now()-nodeStarted;
  const opaDecision=opaById.get(entry.id);
  let nodeEffects=0,opaEffects=0;
  await enforceExistingNodePolicy(entry,async()=>{nodeEffects++});
  if(opaDecision.allow) opaEffects++;
  rows.push({id:entry.id,expected_allow:entry.expected_allow,node:{...nodeDecision,duration_ms:nodeDurationMs,enforced_effects:nodeEffects},opa:{allow:opaDecision.allow,violations:[...opaDecision.violations].sort(),enforced_effects:opaEffects},agreement:nodeDecision.allow===opaDecision.allow,correct:nodeDecision.allow===entry.expected_allow&&opaDecision.allow===entry.expected_allow});
}

const report={version:'mary-kate.opa-comparison.v1',observed_at:new Date().toISOString(),opa:{binary:opa,version:spawnSync(opa,['version'],{encoding:'utf8'}).stdout.trim(),suite_duration_ms:opaDurationMs},summary:{cases:rows.length,node_correct:rows.filter(row=>row.node.allow===row.expected_allow).length,opa_correct:rows.filter(row=>row.opa.allow===row.expected_allow).length,agreement:rows.filter(row=>row.agreement).length,denied_effects_executed:rows.filter(row=>!row.expected_allow&&(row.node.enforced_effects||row.opa.enforced_effects)).length},rows};
if(process.argv[2]) await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!rows.every(row=>row.correct&&row.agreement)||report.summary.denied_effects_executed) process.exitCode=1;
