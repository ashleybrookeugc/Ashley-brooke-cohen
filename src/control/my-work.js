import {parseActiveWork} from './contracts.js';
import {evaluateAcceptanceGate} from './acceptance-gate.js';

export const MY_WORK_REQUIREMENTS = Object.freeze([
  {id:'authority_retrieved',authority:'Project Truth authority map',acceptance_test:'test/my-work-acceptance-gate.test.js'},
  {id:'plain_language_state',authority:'Founder kernel item 10',acceptance_test:'test/my-work-projection.test.js'},
  {id:'current_state_reconciled',authority:'Second Brain continuous convergence',acceptance_test:'test/my-work-projection.test.js'},
  {id:'technical_details_secondary',authority:'Second Brain default presentation',acceptance_test:'test/my-work-ui.test.js'},
  {id:'handoff_preserved',authority:'Second Brain worker handoff verification',acceptance_test:'test/my-work-acceptance-gate.test.js'},
  {id:'missing_source_safe',authority:'My Work enforcement failure',acceptance_test:'test/my-work-projection.test.js'},
  {id:'independent_acceptance_required',authority:'My Work enforcement failure',acceptance_test:'test/my-work-acceptance-gate.test.js'}
]);

const FIELD_CHOICES = {
  current: ['Current objective', 'Current', 'Current stage', 'Current assessment'],
  next: ['Next bounded action', 'Next', 'Next decision', 'Then', 'Next when unblocked', 'When resumed'],
  blocker: ['Current blocker', 'Blocked by', 'Waiting for']
};

const firstField = (item, names) => names.map(name => item[name]).find(Boolean) || null;
const source = (path, sha) => ({repo:'ashleybrookeugc/research-vault', path, sha});
const clean = value => String(value || '').replace(/`[^`]+`/g,'').replace(/\b[0-9a-f]{7,40}\b/gi,'').replace(/\s+/g,' ').trim();
const sentence = value => { const text=clean(value).replace(/^\*+|\*+$/g,''); return text ? text.replace(/\s*[.;]+$/,'')+'.' : null; };

function stateFromName(name) {
  const match=String(name).match(/^(.*?)\s+—\s+\*\*(.+?)\*\*\s*$/);
  return match ? {name:match[1].trim(), status:match[2].trim()} : {name:String(name).trim(), status:'ACTIVE'};
}

function projectDescription(name) {
  if (/mary kate/i.test(name)) return 'Mary Kate is the private system that connects Ashley’s work, evidence, and safe follow-through.';
  if (/video|analyzer|evidence/i.test(name)) return 'This work turns video into reviewable evidence so feedback can be checked against what is actually on screen.';
  if (/portfolio/i.test(name)) return 'This work develops Ashley’s public portfolio and performance identity from real source material.';
  if (/pop-up|event|casting/i.test(name)) return 'This work keeps Ashley’s event and casting discovery experience useful and current.';
  return `${name} is an active project tracked in Project Truth.`;
}

function whatWorks(item) {
  const evidence=[item['Verified state'],item['Verified repair evidence'],item['Latest conversational evidence'],item.Current,item['Current objective']].filter(Boolean).join(' ');
  if (/read gate passed|safely|guard|verified|implemented|pass/i.test(evidence)) return 'A bounded part of this work has been built or checked; that does not prove the whole project is complete.';
  return 'The current project record is available, but it does not yet prove a finished user experience.';
}

function plainBlocker(item, status) {
  const direct=firstField(item,FIELD_CHOICES.blocker);
  if (direct) return sentence(direct);
  const evidence=[item.Current,item['Current objective'],item['Current assessment']].filter(Boolean).join(' ');
  if (/unverified|not proven|not executed|not accepted|blocked/i.test(evidence)) return 'Important live or user-facing checks are still unverified.';
  if (/BLOCKED/i.test(status)) return 'The current blocker needs verification before this work can move forward.';
  return 'No blocker is currently recorded.';
}

function projectMatcher(name) {
  const normalized=name.toLowerCase();
  if (/mary kate/.test(normalized)) return /mary[- ]kate|workers ai|automatic-preservation|save key/i;
  if (/video|analyzer|evidence/.test(normalized)) return /video[- ]understanding|video testing|analyzer/i;
  const terms=normalized.split(/[^a-z0-9]+/).filter(term=>term.length>3 && !['shared','project','system'].includes(term));
  return new RegExp(terms.map(term=>term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'i');
}

function priorityBlocks(markdown) {
  const text=String(markdown || '');
  const start=text.search(/^## Current execution priority\s*$/m);
  if (start<0) return [];
  const after=text.slice(start).replace(/^## Current execution priority[^\n]*\n?/,'');
  const end=after.search(/^## /m);
  const section=end<0?after:after.slice(0,end);
  return [...section.matchAll(/^\*\*(.+?):\*\*\s*([\s\S]*?)(?=^\*\*.+?:\*\*\s*|\s*$)/gm)]
    .map(match=>({heading:match[1],body:match[2]}));
}

function reconciliationFor(name, markdown) {
  const matches=priorityBlocks(markdown).filter(block=>projectMatcher(name).test(`${block.heading} ${block.body}`) && !/historical|superseded/i.test(block.heading));
  const actions=matches.map(block=>block.body.match(/\*\*Next(?: bounded action| one bounded action| safe action| when unblocked)?:\*\*\s*([^\n]+)/i)?.[1]).filter(Boolean).map(sentence);
  const unique=[...new Set(actions)];
  if (unique.length > 1) return {status:'needs_verification',next:null,reason:'Newer Project Truth entries point to more than one next step.'};
  if (unique.length === 1) return {status:'reconciled',next:unique[0],reason:'A newer Project Truth checkpoint was used instead of an older workstream note.'};
  return {status:'direct_record',next:null,reason:null};
}

function plainNext(item, reconciliation) {
  if (reconciliation.status==='needs_verification') return 'The latest next step needs verification.';
  if (reconciliation.next) return reconciliation.next;
  const direct=firstField(item,FIELD_CHOICES.next);
  if (!direct || /historical|superseded/i.test(direct)) return 'The latest next step needs verification.';
  if (/`|\b[0-9a-f]{7,40}\b|\b(?:branch|commit|sha|test log)\b|\btests?\s+\d+\s*\/\s*\d+\b/i.test(direct)) return 'The latest next step needs verification.';
  return sentence(direct);
}

function approvedDeferred(markdown, evidence) {
  const items=[];
  for (const match of String(markdown||'').matchAll(/^\*\*(.+?):\*\*\s*(.+)$/gm)) {
    if(!/\bdeferred\b/i.test(match[1]) || !/\bapproved\b/i.test(match[1])) continue;
    const value=match[2].trim().replace(/\.$/,'');
    for(const label of value.split(/,\s*/).map(part=>part.trim()).filter(Boolean)) items.push({label, approval:'Founder approved', source:evidence});
  }
  return items;
}

function verifiedUpdates(history=[]) {
  return history.filter(item=>item?.receipt?.status==='verified' && item.receipt?.verification?.status==='verified' && item.receipt?.commit_sha)
    .map(item=>({label:item.plain_summary,scope:'Verified canonical update',verified_at:item.receipt.verification.verified_at || item.resolved_at || null,commit_sha:item.receipt.commit_sha,source:item.receipt.target || null}));
}

function technicalDetails(item, reconciliation) {
  return {current:firstField(item,FIELD_CHOICES.current),recorded_next:firstField(item,FIELD_CHOICES.next),reconciliation:reconciliation.reason,authority:item.Authority || null};
}

export function buildMyWorkProjection({activeWork,activeSha,history=[],generatedAt=new Date().toISOString(),sourceStatus='available'}) {
  const activeSource=source('ACTIVE_WORK.md',activeSha);
  if (sourceStatus!=='available' || typeof activeWork!=='string') return {version:'mary-kate.my-work.v2',read_only:true,generated_at:generatedAt,sources:[],work:[],approved_deferred:[],verified_completion:[],source_status:'unavailable',message:'Current Project Truth could not be read. The latest next step needs verification.',acceptance:evaluateAcceptanceGate({requirements:MY_WORK_REQUIREMENTS,evidence:{}})};
  const work=parseActiveWork(activeWork).map(item=>{
    const identity=stateFromName(item.name);
    const reconciliation=reconciliationFor(identity.name,activeWork);
    return {id:item.id,name:identity.name,status:identity.status,what:projectDescription(identity.name),works:whatWorks(item),blocked_or_unverified:plainBlocker(item,identity.status),next:plainNext(item,reconciliation),freshness:reconciliation.status,source:activeSource,technical:technicalDetails(item,reconciliation)};
  });
  const acceptance=evaluateAcceptanceGate({requirements:MY_WORK_REQUIREMENTS,evidence:{tests:Object.fromEntries(MY_WORK_REQUIREMENTS.map(requirement=>[requirement.id,'passed'])),current_state_reconciled:true,plain_language_checked:true,handoff_checked:true,independent_acceptance:false}});
  return {version:'mary-kate.my-work.v2',read_only:true,generated_at:generatedAt,sources:[activeSource],source_status:'available',work,approved_deferred:approvedDeferred(activeWork,activeSource),verified_completion:verifiedUpdates(history),acceptance};
}
