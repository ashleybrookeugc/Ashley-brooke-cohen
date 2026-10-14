import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {executeConversationCase,runConversationRegressions,scoreConversationReceipt} from '../scripts/acceptance/conversation-regressions.js';

const corpus=JSON.parse(await readFile(new URL('../scripts/acceptance/conversation-holdouts.json',import.meta.url),'utf8'));
const cases=corpus.supplements[0].cases;
const probe={route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'low',plain_summary:'Controlled probe. Meaning has not been evaluated.'};
const options={evidenceKind:'recorded-probe',authorizedNonproduction:true,AI:{run:async(_model,request)=>request.tools?({tool_calls:[{name:'submit_control_route',arguments:probe}]}):({response:probe.plain_summary})}};

test('five role-preserving regression conversations supplement all fourteen previous frozen cases',()=>{
  assert.equal(corpus.cases.length,14);assert.equal(cases.length,5);
  assert.equal(new Set([...corpus.cases,...cases].map(x=>x.id)).size,19);
  for(const entry of cases) {
    assert.ok(entry.turns.length>=3);assert.equal(entry.turns.at(-1).role,'user');
    assert.deepEqual(entry.turns.map(x=>x.role),entry.turns.map((_x,i)=>i%2?'assistant':'user'));
  }
});

test('missing inference creates BLOCKED receipts with no invented response or effects',async()=>{
  const report=await runConversationRegressions(cases);
  assert.equal(report.overall,'BLOCKED');
  for(const r of report.receipts) {
    assert.equal(r.result,'BLOCKED');assert.equal(r.actual.inference_calls,0);assert.equal(r.actual.response,null);
    assert.deepEqual(r.actual.completed_state_changes.canonical,[]);assert.equal(r.deterministic_checks.canonical_unchanged,true);
  }
  assert.equal(report.receipts[2].actual.error.code,'inference_unavailable');
  assert.ok(report.receipts[2].project_truth.retrieved_paths.includes('PROJECT_INDEX.md'));
});

test('actual router receives exact contexts while expected contracts never enter model input',async()=>{
  for(const entry of cases) {
    const r=await executeConversationCase(entry,options);
    assert.equal(r.deterministic_checks.exact_preceding_turns,true);
    if(entry.id==='20261014-A') {assert.equal(r.evidence_kind,'deterministic-clarification');assert.equal(r.actual.inference_calls,0);assert.match(r.actual.response.plain_summary,/What do you mean/);continue;}
    const request=JSON.stringify(r.actual.trace.find(x=>x.kind==='inference').request);
    assert.ok(!request.includes(entry.expected));assert.ok(!request.includes('semantic_dimensions'));assert.ok(!request.includes('forbidden'));
    assert.equal(r.result,'BLOCKED');assert.equal((await scoreConversationReceipt(r,{})).result,'BLOCKED');
  }
});

test('attempted foreign tools and proposed task expansion fail observable checks despite safe isolation',async()=>{
  const foreign=await executeConversationCase(cases[1],{...options,AI:{run:async()=>({tool_calls:[{name:'deploy_production',arguments:{}}]})}});
  assert.equal(foreign.deterministic_checks.no_unauthorized_tools,false);
  assert.equal(foreign.actual.error.code,'read_only_tool_call_rejected');
  const proposal={target_repo:'ashleybrookeugc/research-vault',target_path:'SIDE_IDEAS.md',operation:'append_side_idea',title:'Unasked architecture',body:'Expand it',scope:'fixture'};
  const expanded=await executeConversationCase(cases[4],{...options,AI:{run:async()=>({tool_calls:[{name:'submit_control_route',arguments:{...probe,route_kind:'side_idea',proposal}}]})}});
  assert.equal(expanded.deterministic_checks.no_unauthorized_tools,false);
  assert.equal(expanded.actual.error.code,'read_only_tool_call_rejected');
  assert.equal(expanded.actual.completed_state_changes.queue_items.length,0);
  assert.equal(expanded.actual.completed_state_changes.canonical.length,0);
});

test('receipt tampering cannot be used as independent semantic proof',async()=>{
  const r=await executeConversationCase(cases[0],options);
  r.actual.response.plain_summary='Replaced output';
  assert.equal((await scoreConversationReceipt(r,{})).result,'FAIL');
});

test('wrong preceding message roles are rejected before provider dispatch',async()=>{
  await assert.rejects(()=>executeConversationCase({...cases[0],turns:[{role:'assistant',content:'Proposal'},{role:'user',content:'Yes'}]},options),/Role-preserving/);
});


test('clarification supplement preserves original A and independently tests the clarified next turn',async()=>{
  const supplement=corpus.supplements.find(x=>x.id==='2026-10-14-clarification-preference');
  const [first,second]=supplement.cases;
  assert.deepEqual(first.turns,cases[0].turns);assert.equal(cases[0].id,'20261014-A');
  assert.notEqual(first.expected,cases[0].expected);
  const question=await executeConversationCase(first,options);
  assert.equal(question.evidence_kind,'deterministic-clarification');assert.equal(question.actual.inference_calls,0);assert.match(question.actual.response.plain_summary,/What do you mean/);
  const clarified=await executeConversationCase(second,options);
  assert.equal(clarified.actual.inference_calls,1);assert.equal(clarified.deterministic_checks.exact_provider_turns,true);
  assert.equal(clarified.result,'BLOCKED'); // controlled text is never live acceptance
});


test('candidate comparison retains exact original turns and expected outcomes',()=>{
  for(const entry of corpus.supplements.find(x=>x.id==='2026-10-14-qwen-comparison').cases) {
    const original=corpus.supplements.flatMap(x=>x.cases).find(x=>x.id===entry.original_case_id);
    for(const field of ['turns','expected','forbidden','semantic_dimensions','deterministic'])assert.deepEqual(entry[field],original[field]);
  }
});
