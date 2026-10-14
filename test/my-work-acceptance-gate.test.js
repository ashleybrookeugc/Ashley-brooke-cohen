import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evaluateAcceptanceGate} from '../src/control/acceptance-gate.js';
import {MY_WORK_REQUIREMENTS,buildMyWorkProjection} from '../src/control/my-work.js';

test('My Work requirement contract maps every original requirement to an observable test',async()=>{
  const contract=JSON.parse(await readFile(new URL('../docs/my-work-v1-requirements.json',import.meta.url),'utf8'));
  assert.deepEqual(contract.requirements.map(item=>item.id),MY_WORK_REQUIREMENTS.map(item=>item.id));
  assert.ok(contract.authority.some(path=>path.includes('founder-intent-decomposition')));
  assert.ok(contract.authority.some(path=>path.includes('my-work-authority-enforcement-release-failure')));
  for(const id of ['command_center_scope','persistent_chat','priorities_separate','all_projects_retained','workers_separate','scheduled_tasks_truthful','attention_specific']) {
    assert.ok(contract.requirements.some(item=>item.id===id),id);
  }
});

test('a worker cannot turn narrow test results into a completion claim',()=>{
  const gate=evaluateAcceptanceGate({requirements:MY_WORK_REQUIREMENTS,evidence:{tests:Object.fromEntries(MY_WORK_REQUIREMENTS.map(item=>[item.id,'passed'])),current_state_reconciled:true,plain_language_checked:true,handoff_checked:true,independent_acceptance:false}});
  assert.equal(gate.status,'blocked');
  assert.equal(gate.completion_claim_allowed,false);
  assert.match(gate.missing.join(' '),/Independent user acceptance/i);
});

test('missing original requirements block release even when other evidence passes',()=>{
  const gate=evaluateAcceptanceGate({requirements:[{id:'plain_language_state',authority:'Founder intent'}],evidence:{tests:{plain_language_state:'passed'},current_state_reconciled:true,plain_language_checked:true,handoff_checked:true,independent_acceptance:true}});
  assert.equal(gate.status,'blocked');
  assert.match(gate.missing.join(' '),/authority or acceptance test/i);
});

test('the dashboard exposes acceptance as unaccepted instead of claiming complete',()=>{
  const result=buildMyWorkProjection({activeWork:'## Current active workstreams\n### Test — **ACTIVE NOW**\n**Current:** Building.\n**Next:** Test.\n',activeSha:'a'});
  assert.equal(result.acceptance.completion_claim_allowed,false);
  assert.equal(result.acceptance.status,'blocked');
});
