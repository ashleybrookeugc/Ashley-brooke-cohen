import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateUgcConceptGate} from '../src/control/ugc-research-gate.js';
const receipt=kind=>({kind,status:'PROVEN',source:'source:verified-'+kind,verified_by:'independent',scope:'current'});
const all=['brief','current_facts','recent_comparators','opening_analysis','hook_comprehension','visual_premise'].map(receipt);
test('Kalshi missing recent video evidence blocks concept lock',()=>{
 const result=evaluateUgcConceptGate({requiresCurrentResearch:true,receipts:all.filter(r=>!['recent_comparators','opening_analysis'].includes(r.kind))});
 assert.equal(result.allowed,false);assert.deepEqual(result.missing,['recent_comparators','opening_analysis']);
});
test('self-asserted research pass is not trusted',()=>{
 const receipts=all.map(r=>r.kind==='opening_analysis'?{...r,verified_by:'worker'}:r);
 assert.equal(evaluateUgcConceptGate({requiresCurrentResearch:true,receipts}).allowed,false);
});
test('complete independently verified evidence permits concept lock',()=>{
 assert.equal(evaluateUgcConceptGate({requiresCurrentResearch:true,receipts:all}).allowed,true);
});
test('research not material does not demand comparator evidence',()=>{
 assert.equal(evaluateUgcConceptGate({requiresCurrentResearch:false,receipts:all.filter(r=>!['recent_comparators','opening_analysis'].includes(r.kind))}).allowed,true);
});
test('unrelated stages remain untouched',()=>{
 assert.equal(evaluateUgcConceptGate({requestStage:'intake',requiresCurrentResearch:true}).allowed,true);
});
