import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';

if(!process.env.OPA_WASM_SDK||!process.env.OPA_POLICY_WASM) throw new Error('OPA_WASM_SDK and OPA_POLICY_WASM are required');
const {loadPolicy}=await import(pathToFileURL(process.env.OPA_WASM_SDK));
const cases=JSON.parse(await readFile(new URL('./enforcement-cases.json',import.meta.url),'utf8'));
const wasm=await readFile(process.env.OPA_POLICY_WASM);
const loadStarted=performance.now();
const policy=await loadPolicy(wasm);
const loadDurationMs=performance.now()-loadStarted;
const rows=[];
for(const entry of cases) {
  const started=performance.now();
  const result=policy.evaluate(entry)?.[0]?.result;
  const durationMs=performance.now()-started;
  let enforcedEffects=0;
  if(result?.allow) enforcedEffects++;
  rows.push({id:entry.id,expected_allow:entry.expected_allow,decision:result,duration_ms:durationMs,enforced_effects:enforcedEffects,correct:result?.allow===entry.expected_allow&&(!entry.expected_allow?enforcedEffects===0:true)});
}
const report={version:'mary-kate.opa-wasm-evaluation.v1',observed_at:new Date().toISOString(),wasm_bytes:wasm.byteLength,load_duration_ms:loadDurationMs,evaluation_duration_ms:rows.reduce((sum,row)=>sum+row.duration_ms,0),summary:{cases:rows.length,correct:rows.filter(row=>row.correct).length,denied_effects_executed:rows.filter(row=>!row.expected_allow&&row.enforced_effects).length},rows};
if(process.argv[2]) await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!rows.every(row=>row.correct)) process.exitCode=1;
