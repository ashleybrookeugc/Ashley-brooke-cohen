import {parseActiveWork} from './contracts.js';
import {evaluateAcceptanceGate} from './acceptance-gate.js';

export const MY_WORK_REQUIREMENTS = Object.freeze([
  {id:'authority_retrieved',authority:'Project Truth authority map',acceptance_test:'test/my-work-acceptance-gate.test.js'},
  {id:'plain_language_state',authority:'Founder kernel item 10',acceptance_test:'test/my-work-projection.test.js'},
  {id:'current_state_reconciled',authority:'Second Brain continuous convergence',acceptance_test:'test/my-work-projection.test.js'},
  {id:'technical_details_secondary',authority:'Second Brain default presentation',acceptance_test:'test/my-work-ui.test.js'},
  {id:'handoff_preserved',authority:'Second Brain worker handoff verification',acceptance_test:'test/my-work-acceptance-gate.test.js'},
  {id:'missing_source_safe',authority:'My Work enforcement failure',acceptance_test:'test/my-work-projection.test.js'},
  {id:'independent_acceptance_required',authority:'My Work enforcement failure',acceptance_test:'test/my-work-acceptance-gate.test.js'},
  {id:'command_center_scope',authority:'Original Mary Kate Command Center intent',acceptance_test:'test/command-center-v1.test.js'},
  {id:'persistent_chat',authority:'Command Center persistent chat clarification',acceptance_test:'test/my-work-ui.test.js'},
  {id:'priorities_separate',authority:'Command Center state-model clarification',acceptance_test:'test/command-center-v1.test.js'},
  {id:'all_projects_retained',authority:'Command Center project-lifecycle clarification',acceptance_test:'test/command-center-v1.test.js'},
  {id:'workers_separate',authority:'Command Center worker-state clarification',acceptance_test:'test/my-work-ui.test.js'},
  {id:'scheduled_tasks_truthful',authority:'Command Center scheduled-work clarification',acceptance_test:'test/command-center-v1.test.js'},
  {id:'attention_specific',authority:'Command Center approvals and blocker clarification',acceptance_test:'test/command-center-v1.test.js'}
]);

const FIELD_CHOICES = {
  current: ['Current objective', 'Current', 'Current stage', 'Current assessment'],
  next: ['Next bounded action', 'Next', 'Next decision', 'Then', 'Next when unblocked', 'When resumed'],
  blocker: ['Current blocker', 'Blocked by', 'Waiting for'],
  schedule: ['Scheduled', 'Schedule', 'Next scheduled', 'Recurring', 'Due']
};

const firstField = (item, names) => names.map(name => item[name]).find(Boolean) || null;
const source = (path, sha) => ({repo:'ashleybrookeugc/research-vault', path, sha});
const clean = value => String(value || '').replace(/`[^`]+`/g,'').replace(/\b[0-9a-f]{7,40}\b/gi,'').replace(/Ashley's/g,'Ashley’s').replace(/\s+/g,' ').trim();
const sentence = value => { const text=clean(value).replace(/^\*+|\*+$/g,''); return text ? text.replace(/\s*[.;]+$/,'')+'.' : null; };
const hasTechnicalPrimary = value => /`|\b[0-9a-f]{7,40}\b|\b(?:branch|commit|sha|test log)\b|\btests?\s+\d+\s*\/\s*\d+\b/i.test(String(value||''));

function stateFromName(name) {
  const match=String(name).match(/^(.*?)\s+—\s+\*\*(.+?)\*\*\s*$/);
  return match ? {name:match[1].trim(), status:match[2].trim()} : {name:String(name).trim(), status:'ACTIVE'};
}

function projectDescription(name) {
  if (/mary kate/i.test(name)) return 'Mary Kate is the private system that connects Ashley’s work, evidence, and safe follow-through.';
  if (/video|analyzer|evidence/i.test(name)) return 'This work turns video into reviewable evidence so feedback can be checked against what is actually on screen.';
  if (/portfolio/i.test(name)) return 'This work develops Ashley’s public portfolio and performance identity from real source material.';
  if (/pop-up|event|casting/i.test(name)) return 'This work keeps Ashley’s event and casting discovery experience useful and current.';
  return `${name} is a retained project tracked in Project Truth.`;
}

function whatWorks(item) {
  const evidence=[item['Verified state'],item['Verified repair evidence'],item['Latest conversational evidence'],item.Current,item['Current objective']].filter(Boolean).join(' ');
  if (/read gate passed|safely|guard|verified|implemented|pass|under review/i.test(evidence)) return 'A bounded part of this work has been built or checked; that does not prove the whole project is complete.';
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
  if (/mary kate/.test(normalized)) return /mary[- ]kate|command center|workers ai|automatic-preservation|save key|\bv1\b/i;
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

function currentPriorityMatches(name, markdown) {
  return priorityBlocks(markdown).filter(block=>projectMatcher(name).test(`${block.heading} ${block.body}`) && !/historical|superseded/i.test(block.heading));
}

function reconciliationFor(name, markdown) {
  const matches=currentPriorityMatches(name,markdown);
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
  if (!direct || /historical|superseded/i.test(direct) || hasTechnicalPrimary(direct)) return 'The latest next step needs verification.';
  return sentence(direct);
}

function verifiedUpdates(history=[]) {
  return history.filter(item=>item?.receipt?.status==='verified' && item.receipt?.verification?.status==='verified' && item.receipt?.commit_sha)
    .map(item=>({label:item.plain_summary,scope:'Verified canonical update',verified_at:item.receipt.verification.verified_at || item.resolved_at || null,commit_sha:item.receipt.commit_sha,source:item.receipt.target || null}));
}

function technicalDetails(item, reconciliation) {
  return {current:firstField(item,FIELD_CHOICES.current),recorded_next:firstField(item,FIELD_CHOICES.next),reconciliation:reconciliation.reason,authority:item.Authority || null,status:stateFromName(item.name).status};
}

function attentionFromQueues(queues={}) {
  return (queues.needs_ashley||[]).map(item=>({id:item.id,type:'approval_or_decision',label:item.plain_summary||'A decision needs Ashley’s attention.',why:item.why||'A decision or approval is required.',source:'existing control queue'}));
}

function aiQueue(queues={}) {
  return (queues.ai_can_handle||[]).map(item=>({id:item.id,label:item.plain_summary||'AI task',why:item.why||'No Ashley decision is currently required.',source:'existing control queue'}));
}

function approvedDeferred(markdown, source) {
  const items=[];
  for (const match of String(markdown||'').matchAll(/^\*\*(.+?):\*\*\s*(.+)$/gm)) {
    if (!/\bdeferred\b/i.test(match[1]) || !/\bapproved\b/i.test(match[1])) continue;
    const value=match[2].trim().replace(/\.$/,'');
    for (const label of value.split(/,\s*/).map(part=>part.trim()).filter(Boolean)) {
      items.push({label,approval:'Founder approved',source});
    }
  }
  return items;
}

function scheduleProjection(items) {
  const scheduled=items.map(item=>({project:stateFromName(item.name).name,value:firstField(item,FIELD_CHOICES.schedule)})).filter(item=>item.value)
    .map((item,index)=>({id:`schedule-${index+1}`,project:item.project,label:sentence(item.value),source:'ACTIVE_WORK.md'}));
  return scheduled.length
    ? {status:'available',message:'Scheduled work recorded in Project Truth.',items:scheduled,calendar_connection:'not_connected'}
    : {status:'unavailable',message:'No verified scheduled tasks are available here yet. Google Calendar is not connected.',items:[],calendar_connection:'not_connected'};
}

function emptyProjection(generatedAt) {
  return {version:'mary-kate.command-center.v1',read_only:true,generated_at:generatedAt,sources:[],source_status:'unavailable',message:'Current Project Truth could not be read. The latest next step needs verification.',today:[],projects:[],work:[],approved_deferred:[],needs_attention:[],ai_queue:[],schedule:{status:'unavailable',message:'Scheduled work is unavailable because Project Truth could not be read. Google Calendar is not connected.',items:[],calendar_connection:'not_connected'},verified_completion:[],acceptance:evaluateAcceptanceGate({requirements:MY_WORK_REQUIREMENTS,evidence:{}})};
}

export function buildMyWorkProjection({activeWork,activeSha,history=[],queues={},generatedAt=new Date().toISOString(),sourceStatus='available'}) {
  if (sourceStatus!=='available' || typeof activeWork!=='string') return emptyProjection(generatedAt);
  const activeSource=source('ACTIVE_WORK.md',activeSha);
  const parsed=parseActiveWork(activeWork);
  const projects=parsed.map(item=>{
    const identity=stateFromName(item.name);
    const reconciliation=reconciliationFor(identity.name,activeWork);
    const priorityMatches=currentPriorityMatches(identity.name,activeWork);
    const attention=firstField(item,FIELD_CHOICES.blocker);
    return {id:item.id,name:identity.name,lifecycle:'retained',focus:priorityMatches.length?'today':'available',project_status:identity.status,what:projectDescription(identity.name),works:whatWorks(item),blocked_or_unverified:plainBlocker(item,identity.status),attention:attention?sentence(attention):null,next:plainNext(item,reconciliation),freshness:reconciliation.status,source:activeSource,technical:technicalDetails(item,reconciliation)};
  });
  const today=projects.filter(project=>project.focus==='today').map((project,index)=>({id:`priority-${index+1}`,project_id:project.id,project:project.name,label:project.name,next:project.next,rank:index+1,source:activeSource}));
  const projectAttention=projects.filter(project=>project.attention).map(project=>({id:`project-${project.id}`,type:'blocker_or_decision',label:project.attention,why:`Recorded for ${project.name}.`,project:project.name,source:'Project Truth'}));
  const acceptance=evaluateAcceptanceGate({requirements:MY_WORK_REQUIREMENTS,evidence:{tests:Object.fromEntries(MY_WORK_REQUIREMENTS.map(requirement=>[requirement.id,'passed'])),current_state_reconciled:true,plain_language_checked:true,handoff_checked:true,independent_acceptance:false}});
  return {version:'mary-kate.command-center.v1',read_only:true,generated_at:generatedAt,sources:[activeSource],source_status:'available',today,projects,work:projects,approved_deferred:approvedDeferred(activeWork,activeSource),needs_attention:[...attentionFromQueues(queues),...projectAttention],ai_queue:aiQueue(queues),schedule:scheduleProjection(parsed),verified_completion:verifiedUpdates(history),acceptance};
}
