import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {runConversationRegressions} from './conversation-regressions.js';

const corpus=JSON.parse(await readFile(new URL('./conversation-holdouts.json',import.meta.url),'utf8'));
const cases=corpus.supplements.find(x=>x.id==='2026-10-14-followup-regressions').cases;
// CLI has no Workers AI binding. Do not infer credentials, switch providers,
// fetch localhost, or replace missing inference with recorded answers.
// An authorized isolated cloud runtime calls runConversationRegressions with
// its AI binding directly; no new hosted endpoint is deployed by this script.
const report=await runConversationRegressions(cases,{revision:process.argv[3]||'working tree',authority:corpus.supplements[0].provenance});
if(process.argv[2]){await mkdir(dirname(process.argv[2]),{recursive:true});await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({overall:report.overall,cases:report.receipts.map(r=>({id:r.case_id,result:r.result,inference_calls:r.actual.inference_calls,response:r.actual.response,error:r.actual.error,checks:r.deterministic_checks}))},null,2));
process.exitCode=report.overall==='PASS'?0:2;
