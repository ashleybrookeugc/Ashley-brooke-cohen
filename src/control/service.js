import {isReadQuestion,isPriorityQuestion,authorityKind,retrieveIndexedEvidence} from './retrieval.js';
import {routingDiagnostic} from './diagnostics.js';
import {applyProposal,normalizeFactKey,parseActiveWork,parseCanonicalFacts,RouteValidationError,validateRoute,WRITE_REPO} from './contracts.js';
import {buildMyWorkProjection} from './my-work.js';
import {triageRequest} from './triage.js';
const markerStart='<!-- mary-kate-control-write:';
const markerEnd='-->';
const encodeMarker=value=>btoa(unescape(encodeURIComponent(JSON.stringify(value)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const decodeMarker=value=>JSON.parse(decodeURIComponent(escape(atob(value.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-value.length%4)%4)))));
const markerPattern=/\n?<!-- mary-kate-control-write:([A-Za-z0-9_-]+)-->\s*$/;
const stripMarker=content=>String(content).replace(markerPattern,'').trimEnd()+'\n';
const readMarker=content=>{const match=String(content).match(markerPattern);if(!match)return null;try{return decodeMarker(match[1]);}catch{return null;}};
const hash=async value=>{const bytes=new TextEncoder().encode(value);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');};
const canonicalPayload=(target,proposal)=>JSON.stringify({target,proposal});
const canonicalSectionName=value=>String(value||'').split(' — ')[0].trim();
const resolvedWorkstreamSections=receipt=>[...new Set((receipt?.evidence||[]).map(fact=>fact.section).filter(Boolean))];
function enforceResolvedWriteTarget(route,receipt,ambiguityGate) {
  const proposal=route?.proposal;
  if(!proposal||proposal.target_path!=='ACTIVE_WORK.md') return route;
  const sections=[...new Set([...resolvedWorkstreamSections(receipt),...(ambiguityGate?.section?[ambiguityGate.section]:[])])];
  if(!sections.length) throw new PriorStateGateError('ambiguous_scope','Mary Kate cannot bind this state change to a verified workstream, so it changed nothing.',{gate:'authoritative-ambiguity.v1',status:'blocked',evidence:[],blockers:[{reason:'ambiguous_scope',key:'workstream',facts:[]}]});
  if(sections.length!==1) throw new PriorStateGateError('conflict','Mary Kate resolved more than one workstream for this state change, so it changed nothing.',receipt);
  const resolved=sections[0];
  if(canonicalSectionName(proposal.section)!==canonicalSectionName(resolved)) {
    const error=new RouteValidationError('proposal.section','Proposal section does not match the resolved workstream');
    error.code='routing_contract_invalid'; error.status=422;
    error.diagnostic=routingDiagnostic(route,{resolved_workstream:resolved},error);
    error.message='Routing selected a write target outside the resolved workstream. No change was saved.';
    throw error;
  }
  return route;
}
export class CanonicalWriteError extends Error {
  constructor(code,message,status=409){super(message);this.code=code;this.status=status;}
}
export class PriorStateGateError extends Error {
  constructor(code, detail, priorState=null) { super(detail); this.code=code; this.status=code==='conflict'?409:422; this.prior_state=priorState; }
}
const normalizedInput=value=>String(value||'').replace(/[’‘]/g,"'");
const textWords=value=>' '+normalizedInput(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()+' ';
const maryKateInput=text=>textWords(text).replace(/\b(?:mk|marykate)\b/g,'mary kate');
const namesMaryKate=text=>/\b(?:mary kate|ai operating system)\b/.test(maryKateInput(text));
const maryKateSection=section=>/^mary kate(?:\s*\/|$)/i.test(canonicalSectionName(section));
// Mixed assessment/action requests keep the action gates and cannot borrow
// the read-only preference for the canonical operating-system projection.
const readOnlyAssessment=text=>{
  const words=textWords(text);
  return /^\s*(?:please\s+)?(?:(?:can|could|would) you\s+)?(?:do you think|does|is|are|has|have|where|what|how|tell me|show me|give me|assess|evaluate|explain|summarize)\b/i.test(normalizedInput(text))
    && /\b(?:v1|first version|status|stage|stand|complete|completed|completion|finished|unfinished|ready|readiness|left|remain|remains|remaining|outstanding|gaps?|missing|progress)\b/.test(words)
    && !/\b(?:update|set|change|mark|approve|publish|ship|post|send|delete|spend|pay|purchase|transfer|remove|deploy|merge|buy|upload|execute|run|resume|continue|advance)\b/.test(words);
};
function priorityAdviceSummary(activeWork,sha,scope=null,question='') {
  const view=buildMyWorkProjection({activeWork,activeSha:sha});
  const focus=scope?view.projects.filter(project=>project.name===canonicalSectionName(scope)):view.today.map(item=>view.projects.find(project=>project.id===item.project_id)).filter(Boolean);
  const asksBlockers=/\b(?:blockers?|blocked|holding (?:us|me) up)\b/i.test(question);
  if(!focus.length) {
    if(!view.projects.length) return 'I could not find any current projects in the saved work record, so I cannot recommend a priority yet.';
    const waiting=view.projects.filter(project=>/waiting|blocked/i.test(project.project_status));
    if(view.projects.length===1&&waiting.length===1) return `${waiting[0].name} is waiting: ${waiting[0].attention||waiting[0].blocked_or_unverified}`;
    const video=view.projects.find(project=>/video|analyzer|evidence/i.test(project.name)&&/active/i.test(project.project_status));
    return `The saved record does not identify one current focus.${video?' Video processing is still active.':''} I will not rank the other projects from old notes.`;
  }
  if(asksBlockers) return focus.map(project=>{
    const name=/video|analyzer|evidence/i.test(project.name)?'video processing':project.name.replace(/\s*\/\s*AI operating system/i,'');
    return project.blocked_or_unverified&&project.blocked_or_unverified!=='No blocker is currently recorded.'
      ? `${name}: ${project.blocked_or_unverified}`
      : `No specific blocker is saved for ${name}. The next step still needs to be checked with a real result.`;
  }).join(' ');
  return focus.map(project=>{
    const name=/video|analyzer|evidence/i.test(project.name)?'Video processing':project.name.replace(/\s*\/\s*AI operating system/i,'');
    const next=project.next_kind==='conflict'||project.next_kind==='missing'?'The next step needs a current check.':project.next;
    const blocker=project.blocked_or_unverified&&project.blocked_or_unverified!=='No blocker is currently recorded.'?` Still to prove: ${project.blocked_or_unverified}`:'';
    return `${name} is ${scope?'the project you asked about':'the current focus'}. Next: ${next}${blocker}`;
  }).join(' ');
}
const readOnlyReturn=(text,recent)=>Boolean(recent?.turns?.length&&!recent.truncated)
  && /^(?:(?:ok(?:ay)?|alright)[,\s]+)?(?:back|return) to\b/i.test(text.trim())
  && !/\b(?:update|set|change|approve|publish|send|delete|spend|pay|deploy|merge|buy|upload|execute|run|save|record|build|edit)\b/i.test(text);
function readOnlyAssentScope(text,recent,facts,initial,now,ttl) {
  if(!/^(?:yes[,\s]+)?(?:agreed|yes|yep|sure|okay|ok)[.!\s]*$/i.test(text.trim())||recent?.truncated||recent?.turns?.length<2) return null;
  const last=initial.history?.[0],age=now-Date.parse(last?.created_at);
  if(!last||last.route?.route_kind!=='temporary_context'||last.outcome_status==='failed'||!Number.isFinite(age)||age<0||age>ttl) return null;
  if(Object.values(initial.queues||{}).some(rows=>Array.isArray(rows)&&rows.some(row=>!['rejected','applied','completed','superseded'].includes(row.status)))) return null;
  const user=recent.turns.at(-2),assistant=recent.turns.at(-1);
  if(user?.role!=='user'||assistant?.role!=='assistant') return null;
  const unnegated=assistant.content.replace(/\b(?:i|we) (?:will|shall) not (?:change|modify|write|delete|deploy|publish|send)[^.?!]*[.?!]?/gi,'');
  if(!/\b(?:i|we) can (?:read|inspect|check|review)\b/i.test(unnegated)||!/\b(?:v1|assessment|status|readiness|completion|proof)\b/i.test(unnegated)) return null;
  if(/\b(?:or|either|alternatively|update|change|modify|write|delete|deploy|publish|send|spend|pay|merge|approve|execute|run|save|record|buy|purchase|transfer|remove|post|upload|build|edit|hire|book|schedule|launch)\b/i.test(unnegated)) return null;
  const resolution=resolveAuthoritativeWorkstream('What is the V1 assessment? '+user.content,facts);
  return resolution.status==='resolved'&&maryKateSection(resolution.section)?resolution.section:null;
}
const sectionScore=(text,section)=>{
  const heading=section.split(' — ')[0].trim();
  const words=textWords(heading).trim().split(' ').filter(Boolean);
  const input=textWords(text);
  if(input.includes(' '+words.join(' ')+' ')) return words.length+100;
  // A partial project name is useful only when it identifies one section.
  const distinctive=words.filter(word=>word.length>2&&!(isReadQuestion(text)?['and','the','for','with','app']:[]).includes(word)&&!['active','now','parallel','blocked','resumable','paused','waiting','ashley','current','project','work','system','operating','reconciliation','truth'].includes(word));
  return distinctive.filter(word=>input.includes(' '+word+' ')).length;
};
export function resolveAuthoritativeWorkstream(text, facts) {
  const sections=[...new Set(facts.map(f=>f.section))].filter(section=>section!=='document'&&!/^\d{4}-\d{2}-\d{2}/.test(section)&&! /^(?:current focus|current execution priority|current active workstreams|session handoff rule|rules)$/i.test(section));
  const ugcApp=/\b(?:ugc app|ugc creator app|contentease)\b/i.test(text);
  if(ugcApp&&!namesMaryKate(text)&&! /\bb-paid\b/i.test(text)) {
    const matches=sections.filter(section=>/^ContentEase\s*\//i.test(section));
    const others=sections.filter(section=>!/^ContentEase\s*\/|^UGC\s*\//i.test(section)&&sectionScore(text,section)>0);
    if(matches.length===1&&!others.length)return {status:'resolved',section:matches[0],candidates:matches};
  }
  const aliasInput=maryKateInput(text);
  const input=namesMaryKate(text)?(/\bmary kate\b/.test(aliasInput)?aliasInput:aliasInput.replace(/\bai operating system\b/g,'mary kate')):text;
  const scores=sections.map(section=>({section,score:sectionScore(input,section)}));
  // Distinct explicit project names cannot compete by heading length. This
  // applies to actions as well as questions, including a short alias vs a name.
  const family=section=>canonicalSectionName(section).split(' / ')[0];
  const explicitFamilies=[...new Set(sections.map(family).filter(name=>textWords(input).includes(textWords(name))))];
  if(explicitFamilies.length>1) return {status:'ambiguous',section:null,candidates:sections.filter(section=>explicitFamilies.includes(family(section)))};
  if(namesMaryKate(text)&&isReadQuestion(text)) {
    const named=scores.filter(candidate=>candidate.score>0);
    // A second named project remains ambiguous, even if its shorter heading
    // would have lost the token-overlap competition.
    if(named.some(candidate=>!maryKateSection(candidate.section))) return {status:'ambiguous',section:null,candidates:named.map(candidate=>candidate.section)};
    const exact=named.filter(candidate=>candidate.score>100);
    const current=named.filter(candidate=>/^mary kate\s*\/\s*ai operating system$/i.test(canonicalSectionName(candidate.section)));
    const preferred=exact.length?exact:current.length?current:named;
    return {status:preferred.length===1?'resolved':preferred.length>1?'ambiguous':'unknown',section:preferred.length===1?preferred[0].section:null,candidates:preferred.map(candidate=>candidate.section)};
  }
  const best=Math.max(0,...scores.map(candidate=>candidate.score));
  const candidates=scores.filter(candidate=>best>0&&candidate.score===best).map(candidate=>candidate.section);
  return {status:candidates.length===1?'resolved':candidates.length>1?'ambiguous':'unknown',section:candidates.length===1?candidates[0]:null,candidates};
}
const continuationWithoutBinding=text=>/^(?:yes|yep|sure|ok(?:ay)?|fine|go ahead|carry on|continue|do that|use that|send it|send whichever|the one we discussed)\b/i.test(text.trim());
const activeWorkstreamSections=facts=>[...new Set((facts||[]).map(fact=>fact.section).filter(section=>{
  if(!section||section==='document'||/^(?:session handoff rule|current focus|current active workstreams|current execution priority)$/i.test(section)) return false;
  return !/\b(?:paused|waiting|blocked|inactive|completed|done)\b/i.test(section);
}))];
const unqualifiedWorkstreamRequest=text=>/^(?:(?:(?:can you|could you|please)\s+)?(?:tell me\s+|show me\s+|give me\s+)?(?:what(?:'s| is)\s+(?:the\s+)?(?:next|next step|next action|next bounded action|current action|current priority|current status|current stage|latest status)\b|what should (?:(?:we|i)\s+)?(?:do|happen)\s+next\b|what needs to happen next\b)|(?:(?:which|what)\s+(?:project|workstream|thread)\s+should\s+(?:we|i)\b)|(?:(?:advance|resume|continue|proceed|move forward|update|set|change|approve|publish|send|delete|spend|transfer|remove)\b))/i.test(String(text||'').trim());
export function createAmbiguityGate(text,facts) {
  text=normalizedInput(text);
  const resolution=resolveAuthoritativeWorkstream(text,facts);
  if(resolution.status==='ambiguous') return {...resolution,status:'blocked',reason:'multiple_current_referents'};
  if(resolution.status==='unknown'&&namesMaryKate(text)) return {...resolution,status:'blocked',reason:'missing_workstream_context'};
  if(resolution.status==='unknown'&&continuationWithoutBinding(text)) return {...resolution,status:'blocked',reason:'unbound_continuation'};
  if(resolution.status==='unknown'&&unqualifiedWorkstreamRequest(text)) {
    const active=activeWorkstreamSections(facts);
    if(active.length!==1) return {...resolution,status:'blocked',reason:active.length>1?'unbound_workstream_request':'missing_workstream_context',candidates:active};
  }
  return {...resolution,status:'passed'};
}
const requestedFacts = (text, facts, projects, explicit=[]) => {
  if (!Array.isArray(explicit) || explicit.some(key => typeof key !== 'string')) throw new PriorStateGateError('invalid_request','required_fact_keys must be an array of strings');
  const words=textWords(text);
  // A field name inside a longer field name is not a separate request. Keep
  // standalone occurrences, so "next and next bounded action" still asks for both.
  const spans=[...new Set(facts.map(f=>f.key))].flatMap(key=>{
    const phrase=' '+key.replaceAll('-',' ')+' ', found=[];
    for(let at=words.indexOf(phrase);at!==-1;at=words.indexOf(phrase,at+1)) found.push({key,start:at,end:at+phrase.length});
    return found;
  }).sort((a,b)=>(b.end-b.start)-(a.end-a.start)||a.start-b.start);
  const selected=[];
  for(const span of spans) if(!selected.some(other=>other.start<=span.start&&other.end>=span.end)) selected.push(span);
  const keys=[...new Set([...explicit.map(normalizeFactKey).filter(Boolean),...selected.map(span=>span.key)])];
  return keys.map(key=>{
    // Resolve the named workstream before looking for a field in it. A missing
    // field in the named workstream must not borrow a same-named field from a
    // different Mary Kate projection or another project.
    return {key,section:resolveAuthoritativeWorkstream(text,facts).section};
  });
};
export function createPriorStateReceipt(packet, requiredFacts=[]) {
  const material=[packet.source];
  const evidence=[], blockers=[];
  for (const request of requiredFacts) {
    const key=typeof request==='string'?normalizeFactKey(request):normalizeFactKey(request?.key);
    const section=typeof request==='object'&&request?.section?request.section:null;
    const all=packet.facts.filter(f => f.key===key);
    const matches=section?all.filter(f=>f.section===section):all;
    const values=[...new Set(matches.map(f => f.value))];
    if (!matches.length) blockers.push({key,section,reason:'missing'});
    else if (!section&&new Set(matches.map(f=>f.section)).size>1) blockers.push({key,reason:'ambiguous_scope',facts:matches.map(({id,label,value,section})=>({id,label,value,section}))});
    else if (values.length!==1) blockers.push({key,section,reason:'conflict',facts:matches.map(({id,label,section,value})=>({id,label,section,value}))});
    else evidence.push({...matches[0],source:packet.source});
  }
  return {gate:'prior-state.context-retrieval',status:blockers.length?'blocked':requiredFacts.length?'passed':'not_required',required_fact_keys:requiredFacts.map(x=>typeof x==='string'?normalizeFactKey(x):normalizeFactKey(x?.key)),material,evidence,blockers};
}
function requirePriorState(receipt) {
  if (receipt.status!=='blocked') return;
  const conflict=receipt.blockers.find(x=>x.reason==='conflict');
  if (conflict) throw new PriorStateGateError('conflict','Mary Kate found conflicting saved information inside the same workstream, so it changed nothing.',receipt);
  const ambiguous=receipt.blockers.find(x=>x.reason==='ambiguous_scope');
  if (ambiguous) throw new PriorStateGateError('ambiguous_scope','Mary Kate found this field in more than one workstream and could not safely tell which one you meant, so it changed nothing.',receipt);
  throw new PriorStateGateError('missing','Mary Kate could not find the required saved information, so it changed nothing.',receipt);
}

// This is intentionally a translation boundary: policy and internal evidence stay
// structured, while the UI receives a decision-ready explanation rather than a
// schema key it would have to decipher.
function translateControlError(error) {
  if (error instanceof PriorStateGateError) {
    if(error.code==='invalid_request') return {error:error.message,code:'invalid_request'};
    const conflict=error.prior_state?.blockers?.find(blocker=>blocker.reason==='conflict');
    if (conflict) {
      const choices=conflict.facts.map(fact=>({source:fact.section||fact.id,value:fact.value}));
      const field=conflict.facts[0]?.label||conflict.key.replaceAll('-',' ');
      const nextAction=conflict.key==='next-bounded-action';
      return {
        error:nextAction?"I found conflicting saved information about what the next action should be, so I didn't change anything.":'I found conflicting saved information about '+field+', so I didn\'t change anything.',
        code:'prior_state_conflict',
        technical:{version:'control-error.v1',kind:'prior_state_conflict',prior_state:error.prior_state},
        action:{required:true,prompt:nextAction?'Choose which saved next action is current before Mary Kate can continue.':'Choose which saved '+field+' is current before Mary Kate can continue.',choices}
      };
    }
    const ambiguous=error.prior_state?.blockers?.find(blocker=>blocker.reason==='ambiguous_scope');
    if (ambiguous) return {
      error:"I can't safely tell which workstream you mean, so I didn't change anything.",
      code:'prior_state_ambiguous_scope',
      technical:{version:'control-error.v1',kind:'prior_state_ambiguous_scope',prior_state:error.prior_state},
      action:{required:true,prompt:'Name the project or workstream whose saved information you mean.',choices:[...new Set(ambiguous.facts.map(fact=>fact.section))].map(source=>({source}))}
    };
    const missing=error.prior_state?.blockers?.find(blocker=>blocker.reason==='missing');
    const workstream=missing?.section?.split(' — ')[0];
    const field=missing?.key==='next-bounded-action'?'next action':missing?.key?.replaceAll('-',' ')||'information';
    return {
      error:workstream?`I couldn't find a saved ${field} for ${workstream}, so I didn't change anything.`:"I couldn't find the saved information needed to make this change, so I didn't change anything.",
      code:'prior_state_missing',
      technical:{version:'control-error.v1',kind:'prior_state_missing',prior_state:error.prior_state},
      action:{required:true,prompt:workstream?`Confirm the current ${field} for ${workstream} in Project Truth before Mary Kate can continue.`:'Provide or confirm the missing current information before Mary Kate can continue.'}
    };
  }
  return {error:error?.message||'Control request failed',code:error?.code||'invalid_request',...(error?.interaction_id?{interaction_id:error.interaction_id,technical:{interaction_id:error.interaction_id,diagnostic:error.diagnostic}}:{})};
}
export function controlErrorResponse(error) {return {...translateControlError(error),...(error?.retrieval_trace?{retrieval_trace:error.retrieval_trace}:{})};}
export function createControlTaskPacket(snapshot) {
  return {
    version:'control-task-packet.v1',
    purpose:'control_route',
    active_work:{projects:snapshot.projects,source:snapshot.source},
    freshness:snapshot.context,
    prior_state:snapshot.prior_state,
    ambiguity_gate:snapshot.ambiguity_gate,
    ...(snapshot.triage?{triage:snapshot.triage}:{}),
    ...(snapshot.recent_conversation?{recent_conversation:snapshot.recent_conversation}:{}),
    ...(snapshot.intent?{intent:snapshot.intent}:{}),
    ...(snapshot.completion_authority?{completion_authority:snapshot.completion_authority}:{}),
    ...(snapshot.retrieval_evidence?{retrieval_evidence:snapshot.retrieval_evidence}:{}),
    ...(snapshot.conversation_history?.length?{conversation_history:snapshot.conversation_history}:{})
  };
}

export function normalizeConversationHistory(value) {
  if(value==null) return [];
  if(!Array.isArray(value)) throw new PriorStateGateError('invalid_request','conversation_history must be an array');
  if(value.length>12) throw new PriorStateGateError('invalid_request','A conversation can contain at most 12 recent messages');
  return value.map(message=>{
    if(!message||!['user','assistant'].includes(message.role)||typeof message.text!=='string') throw new PriorStateGateError('invalid_request','Conversation messages require a user or assistant role and text');
    const text=message.text.trim();
    if(!text||text.length>2000) throw new PriorStateGateError('invalid_request','Conversation messages must be 1–2000 characters');
    return {role:message.role,text};
  });
}

const commandCenterOverviewQuestion=text=>/\b(?:all\s+(?:project\s+)?tasks?|prioriti(?:ze|zed|zation|es)|time management|what should i (?:do|focus on)|today(?:'s)? (?:work|tasks?|priorities)|across (?:my|all) projects?)\b/i.test(normalizedInput(text));
const conversationWorkstream=(history,facts,pageContext)=>{
  for(let index=history.length-1;index>=0;index--) {
    if(history[index].role!=='user') continue;
    const resolution=resolveAuthoritativeWorkstream(history[index].text,facts);
    if(resolution.status==='resolved') return resolution.section;
    if(resolution.status==='ambiguous') return null;
    // Reconstruct the server's page-scoped V1 answer, never a scope claimed
    // by assistant prose. History remains conversation context, not authority.
    if(pageContext==='mary-kate-command-center'&&readOnlyAssessment(history[index].text)) {
      const pageResolution=resolveAuthoritativeWorkstream(`${history[index].text} For Mary Kate.`,facts);
      if(pageResolution.status==='resolved') return pageResolution.section;
    }
  }
  return null;
};
async function retrieveCompletionAuthority(github) {
  // Follow the existing index instead of baking in a dated filename or verdict.
  const index=await github.readFile(WRITE_REPO,'PROJECT_INDEX.md');
  const routes=String(index.content).split(/\r?\n/).filter(line=>/^\| Mary Kate current V1 completion\/gap\/evidence status \|/.test(line));
  const path=routes.length===1?routes[0].split('|')[2]?.match(/`([^`]+)`/)?.[1]:null;
  if(!index.sha||!path||!/^research\/ai-workflows\/[a-zA-Z0-9_-]+\.md$/.test(path)) throw new PriorStateGateError('missing','Mary Kate could not verify its indexed completion authority. No change was saved.');
  const source=await github.readFile(WRITE_REPO,path);
  if(!source.sha||!String(source.content||'').includes('V1 completion assessment')) throw new PriorStateGateError('missing','Mary Kate could not retrieve verified completion evidence. No change was saved.');
  return {source:{repo:WRITE_REPO,path,sha:source.sha},routing_source:{repo:WRITE_REPO,path:'PROJECT_INDEX.md',sha:index.sha},content:source.content};
}
function completionAssessment(authority) {
  const content=String(authority?.content||'');
  const match=content.match(/\*\*(\d+) rows:\*\*\s*VERIFIED\s+(\d+);\s*PARTIAL\s+(\d+);\s*IMPLEMENTED\s+—\s+UNVERIFIED\s+(\d+);\s*NOT IMPLEMENTED\s+(\d+)/i);
  if(!match) return null;
  const [total,verified,partial,implementedUnverified,notImplemented]=match.slice(1).map(Number);
  if([total,verified,partial,implementedUnverified,notImplemented].some(value=>!Number.isSafeInteger(value)||value<0)) return null;
  const unfinished=partial+implementedUnverified+notImplemented;
  const rows=[...content.matchAll(/^\d+\.\s+\*\*(.+?)\s+—\s+(VERIFIED|PARTIAL|IMPLEMENTED\s+—\s+UNVERIFIED|NOT IMPLEMENTED|BLOCKED|STALE\s+—\s+RECONCILIATION REQUIRED)\.\*\*/gmi)]
    .filter(row=>row[2].toUpperCase()!=='VERIFIED')
    .map(row=>row[1]);
  const has=pattern=>!rows.length||rows.some(title=>pattern.test(title));
  const gaps=[];
  if(has(/intent\/workstream|scenario a|clean-room semantic retrieval/i)) gaps.push('understand ordinary questions without making you name projects or technical systems');
  if(has(/authority map|authoritative retrieval|continuous state|scenario d/i)) gaps.push('keep project information current automatically');
  if(has(/context compiler|capability selector|gate\/preflight|verification\/completion|safe publishing|scenario b|production route|contextless delegation/i)) gaps.push('give work to the right AI worker and return a clear result that was actually checked');
  if(has(/scenario c|durable continuation/i)) gaps.push('continue after interruptions without making you carry messages between systems');
  if(has(/plain-language state|scenario f|mobile-first operation/i)) gaps.push('explain status and next steps clearly on your phone');
  if(has(/scenario e|bounded media\/video proof/i)) gaps.push('complete one small real video task without risking the original file');
  if(!gaps.length&&unfinished) gaps.push('finish and prove the remaining V1 abilities from start to finish');
  const plain_summary=unfinished
    ? `Not yet. The Command Center opens on your phone and can read the latest saved project information without changing it. But Mary Kate has not yet proved the full experience from start to finish.\n\nStill to prove:\n${gaps.map(gap=>'• '+gap).join('\n')}\n\nNext: run one real task from this phone screen all the way from your request to a clear result that was actually checked. Any confusing, stale, or wrong step means V1 is still not ready.`
    : 'The latest saved information says the full V1 experience has been proved. Ashley still needs to decide whether the experience is understandable and useful enough to accept.';
  return {
    route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'high',plain_summary,
    technical_summary:`V1 source status: ${total} total; ${verified} verified complete; ${partial} partial; ${implementedUnverified} implemented but unverified; ${notImplemented} not implemented.`
  };
}
export function createControlService({github,router,store,now=()=>Date.now(),packetTtlMs=300000,observe=()=>{},deployment=null}) {
  const state = async ({refresh=false,requiredFacts=[],requiredFactKeys=[]}={}) => {
    const key='active-work.v1';
    if(refresh) await store.invalidateContextPacket(key);
    let packet=await store.getContextPacket(key);
    let reused=Boolean(packet);
    if(packet&&!Array.isArray(packet.facts)){packet=null;reused=false;}
    if(!packet){const source=await github.readFile(WRITE_REPO,'ACTIVE_WORK.md');const created_at=new Date(now()).toISOString();packet={raw_content:source.content,projects:parseActiveWork(source.content),facts:parseCanonicalFacts(source.content),source:{repo:WRITE_REPO,path:'ACTIVE_WORK.md',sha:source.sha},created_at,expires_at:new Date(now()+packetTtlMs).toISOString()};await store.putContextPacket(key,packet);}
    const prior_state=createPriorStateReceipt(packet,requiredFacts.length?requiredFacts:requiredFactKeys);
    return {routing_diagnostics:{version:'control-routing-failure.v1',storage:'control_interactions.route_json'},ambiguity_gate:{version:'authoritative-ambiguity.v1'},projects:packet.projects,source:packet.source,context:{status:reused?'reused':'refreshed',created_at:packet.created_at,expires_at:packet.expires_at},fact_keys:[...new Set(packet.facts.map(f=>f.key))],prior_state,queues:await store.listQueues(),history:await store.listHistory(20)};
  };
  return {
    state,
    async myWork() {
      try {
        const [activeWork,history,queues]=await Promise.all([
          github.readFile(WRITE_REPO,'ACTIVE_WORK.md'),
          store.listHistory(50),
          store.listQueues()
        ]);
        return buildMyWorkProjection({activeWork:activeWork.content,activeSha:activeWork.sha,history,queues,generatedAt:new Date(now()).toISOString()});
      } catch {
        return buildMyWorkProjection({sourceStatus:'unavailable',generatedAt:new Date(now()).toISOString()});
      }
    },
    async capture(text,{requiredFactKeys=[],contextWorkstream=null,refreshContext=false,conversationHistory=[],conversationId=null}={}) {
      const started=now();
      const trace={version:'control-retrieval-trace.v1',request_id:crypto.randomUUID(),deployment,stages:[]};
      const mark=(stage,details={})=>{trace.stages.push({stage,elapsed_ms:now()-started,...details});};
      try {
      mark('input',{characters:typeof text==='string'?text.length:0});
      if(typeof text!=='string'||!text.trim()||text.length>4000) throw new Error('Message must be 1–4000 characters');
      const history=normalizeConversationHistory(conversationHistory);
      if(conversationId!=null&&!/^[A-Za-z0-9_-]{8,80}$/.test(conversationId)) throw new PriorStateGateError('invalid_request','conversation_id is invalid');
      mark('conversation',{messages:history.length});
      const initial=await state({refresh:refreshContext===true});
      // Scope each requested fact against the actual canonical facts, not the de-duplicated key list.
      const packet=await store.getContextPacket('active-work.v1');
      mark('current_work',{source:initial.source,cache:initial.context.status,source_characters:packet?.raw_content?.length||0});
      const facts=packet?.facts||[];
      const recentConversation={turns:history.map(({role,text})=>({role,content:text})),truncated:false};
      const previousAssistant=recentConversation.turns.at(-1)?.role==='assistant'?recentConversation.turns.at(-1).content:'';
      const lastHistory=initial.history?.[0];
      const lastRoute=lastHistory?.route||lastHistory||(/your priorities are:/i.test(previousAssistant)?{model_selection:{task:'priority_advice'}}:null);
      const triage=triageRequest(text,{recent:recentConversation,lastRoute});
      const previousScope=triage.priority_followup?lastRoute?.model_selection?.scope_section:null;
      const priorityScope=previousScope&&facts.some(fact=>fact.section===previousScope)?previousScope:null;
      const rawResolution=resolveAuthoritativeWorkstream(priorityScope?`For ${canonicalSectionName(priorityScope)}, ${text}`:text,facts);
      const priorConversationSection=rawResolution.status==='unknown'?conversationWorkstream(history,facts,contextWorkstream):null;
      const kind=authorityKind(text,rawResolution.section||priorConversationSection);
      const commandCenterOverview=!priorConversationSection&&activeWorkstreamSections(facts).length>0&&isPriorityQuestion(text);
      const assentScope=readOnlyAssentScope(text,recentConversation,facts,initial,now(),packetTtlMs);
      // The persistent Command Center chat may supply its page context for an
      // otherwise unqualified read-only assessment. It never overrides an
      // explicit project, an ambiguous request, or anything action-bearing.
      const useCommandCenterContext=contextWorkstream==='mary-kate-command-center'
        && readOnlyAssessment(text)
        && rawResolution.status==='unknown';
      const scopedText=priorityScope?`For ${canonicalSectionName(priorityScope)}, ${text}`:assentScope?`What is the V1 assessment for ${canonicalSectionName(assentScope)}?`:priorConversationSection?`${text.trim()} Continue the conversation about ${canonicalSectionName(priorConversationSection)}.`:useCommandCenterContext?`${text.trim()} For Mary Kate.`:text;
      const wholeWorkload=triage.mode==='priority_advice'&&rawResolution.status==='unknown'&&!priorConversationSection;
      const actionScope=triage.mode==='action'&&rawResolution.status==='unknown'?triage.action_scope_text:scopedText;
      const navigation=readOnlyReturn(text,recentConversation);
      const ambiguity_gate=(wholeWorkload||commandCenterOverview)&&rawResolution.status==='unknown'
        ? {status:'passed',section:null,candidates:[],scope:'all_current_workstreams'}
        : navigation?{status:'passed',section:null,candidates:[],reason:'conversation_navigation_read_only'}
        : createAmbiguityGate(actionScope,facts);
      mark('workstream',{...ambiguity_gate});
      if(ambiguity_gate.status==='blocked') {
        const detail=ambiguity_gate.reason==='unbound_workstream_request'?'Mary Kate found more than one workstream and could not bind this request to one current workstream, so it changed nothing.':'Mary Kate could not bind this request to one current workstream, so it changed nothing.';
        throw new PriorStateGateError('ambiguous_scope',detail,{gate:'authoritative-ambiguity.v1',status:'blocked',evidence:[],blockers:[{reason:'ambiguous_scope',key:'workstream',facts:ambiguity_gate.candidates.map(section=>({section,label:'workstream'}))}]});
      }
      if(triage.mode==='priority_advice') {
        if(!Array.isArray(requiredFactKeys)||requiredFactKeys.some(key=>typeof key!=='string')) throw new PriorStateGateError('invalid_request','required_fact_keys must be an array of strings');
        // A whole-workload question reads the current registry and its explicit
        // focus. It does not ask for every historical project's Next field.
        // This branch precedes generic field retrieval so missing or duplicated
        // legacy fields cannot turn a useful read-only answer into HTTP 422.
        const prior_state=createPriorStateReceipt(packet,requiredFactKeys.map(key=>({key:normalizeFactKey(key),section:ambiguity_gate.section})));
        requirePriorState(prior_state);
        const route={route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'high',plain_summary:priorityAdviceSummary(packet.raw_content,packet.source.sha,ambiguity_gate.section,text),why:'Deterministic read-only triage; no model call or mutation authority.',triage,prior_state,model_selection:{provider:'none',calls:0,task:'priority_advice',...(ambiguity_gate.section?{scope_section:ambiguity_gate.section}:{})}};
        const interaction=await store.addInteraction({raw_text:text.trim(),route:{...route,retrieval_trace:trace}});
        mark('response',{response_type:route.route_kind,queue_item_created:false});
        try {observe(trace);} catch {}
        return {retrieval_trace:trace,interaction_id:interaction.id,conversation_id:conversationId,plain_summary:route.plain_summary,responsibility:route.responsibility,route_kind:route.route_kind,queue_item:null,model_selection:route.model_selection,triage,handoff:{status:'conversation_active',can_clear:false,message:'This is still a conversation. No task or GitHub change has been claimed.'}};
      }
      const readOnly=triage.read_only||readOnlyAssessment(text)||isReadQuestion(text);
      mark('intent',{intent:readOnly?'read_only_assessment':'action_or_unclassified'});
      if(!Array.isArray(requiredFactKeys)||requiredFactKeys.some(key=>typeof key!=='string')) throw new PriorStateGateError('invalid_request','required_fact_keys must be an array of strings');
      const assessmentKeys=readOnlyAssessment(text)&&maryKateSection(ambiguity_gate.section)?[...new Set((packet?.facts||[]).filter(fact=>fact.section===ambiguity_gate.section&&['current-stage','current','current-assessment'].includes(fact.key)).map(fact=>fact.key))]:[];
      // Inherited or explicitly named workstream titles are scope, not fact
      // requests (Evidence engine must not demand a missing Evidence field).
      // Keep genuine requested fields and every caller-specified requirement.
      let factText=readOnly?text:scopedText;
      if(readOnly&&ambiguity_gate.section)factText=textWords(factText).replace(textWords(canonicalSectionName(ambiguity_gate.section)),' ');
      if(readOnly&&isPriorityQuestion(text))factText=factText.replace(/\bnext\b/gi,'');
      const scoped=triage.mode==='priority_advice'
        ? requiredFactKeys.map(key=>({key:normalizeFactKey(key),section:ambiguity_gate.section}))
        : requestedFacts(factText,facts,initial.projects,[...requiredFactKeys,...(readOnlyAssessment(text)&&maryKateSection(ambiguity_gate.section)?assessmentKeys.length?assessmentKeys:['current-stage']:[])]).map(request=>({...request,section:request.section||ambiguity_gate.section}));
      const snapshot=scoped.length?await state({requiredFacts:scoped}):initial;
      snapshot.ambiguity_gate=ambiguity_gate;
      snapshot.conversation_history=history;
      snapshot.triage=triage;
      snapshot.recent_conversation=recentConversation;
      if(readOnly) snapshot.intent=readOnlyAssessment(text)||assentScope?'read_only_assessment':'read_only_advice';
      if(assentScope) snapshot.read_only_continuation={source:'single_immediate_private_assessment_offer',section:assentScope,permission_authority:false};
      mark('prior_state',{status:snapshot.prior_state.status,required_fact_keys:snapshot.prior_state.required_fact_keys});
      requirePriorState(snapshot.prior_state);
      if((readOnlyAssessment(text)||assentScope)&&maryKateSection(ambiguity_gate.section)) snapshot.completion_authority=await retrieveCompletionAuthority(github);
      if(readOnly&&triage.mode==='greeting') {
        const route={route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'high',plain_summary:'I’m here. Ask about your current work, priorities, or a specific project.',why:'Deterministic read-only triage; no model call or mutation authority.',triage,prior_state:snapshot.prior_state,model_selection:{provider:'none',calls:0,task:triage.mode,...(ambiguity_gate.section?{scope_section:ambiguity_gate.section}:{})}};
        const interaction=await store.addInteraction({raw_text:text.trim(),route:{...route,retrieval_trace:trace}});
        mark('response',{response_type:route.route_kind,queue_item_created:false});
        try {observe(trace);} catch {}
        return {retrieval_trace:trace,interaction_id:interaction.id,conversation_id:conversationId,plain_summary:route.plain_summary,responsibility:route.responsibility,route_kind:route.route_kind,queue_item:null,model_selection:route.model_selection,triage,handoff:{status:'conversation_active',can_clear:false,message:'This is still a conversation. No task or GitHub change has been claimed.'}};
      }
      if(readOnly&&!snapshot.completion_authority) {
        const retrievalText=kind==='current'&&ambiguity_gate.section?`${text} Context: ${canonicalSectionName(ambiguity_gate.section)}.`:text;
        snapshot.retrieval_evidence=await retrieveIndexedEvidence(github,retrievalText,{activeWork:typeof packet.raw_content==='string'?{content:packet.raw_content,sha:packet.source.sha}:await github.readFile(WRITE_REPO,'ACTIVE_WORK.md'),kind});
        // The answer packet needs the relevant current paragraphs, not every project's history.
        snapshot.projects=ambiguity_gate.section?initial.projects.filter(project=>project.name===ambiguity_gate.section):[];
      }
      // A Command Center V1-status question has a canonical indexed answer.
      // Keep this narrow read-only path independent of a model's ability to
      // emit the control-route schema; all broader conversation still routes
      // through the existing policy adapter and gates below.
      mark('retrieval',{sources:snapshot.retrieval_evidence?.sources.map(x=>({...x.source,selected_characters:x.selected_characters,paragraphs:x.excerpts.map(e=>e.paragraph)}))||[snapshot.completion_authority?.source||initial.source],routing_source:snapshot.retrieval_evidence?.routing_source||snapshot.completion_authority?.routing_source||null,missing:snapshot.retrieval_evidence?.missing||[]});
      let candidate=contextWorkstream==='mary-kate-command-center'&&readOnlyAssessment(text)&&maryKateSection(ambiguity_gate.section)
        ? completionAssessment(snapshot.completion_authority)
        : null;
      let technicalSummary=null;
      if(candidate) {
        technicalSummary=candidate.technical_summary||null;
        const {technical_summary,...publicCandidate}=candidate;
        candidate=validateRoute(publicCandidate);
      }
      else try {
        const taskPacket=createControlTaskPacket(snapshot);
        const characters=JSON.stringify(taskPacket).length;
        mark('routing_dispatch',{context_characters:characters,estimated_tokens:Math.ceil(characters/4),token_estimate_method:'characters/4; not provider usage'});
        const output=await router.route(text.trim(),taskPacket,{observeModel:details=>mark('model_metrics',details)});
        mark('routing_return',{route_kind:output?.route_kind,proposal_present:Boolean(output?.proposal)});
        try {candidate=validateRoute(output);} catch(error) {
          error.code='routing_contract_invalid';error.status=422;
          error.diagnostic=routingDiagnostic(output,{},error);
          error.message='Routing could not produce a valid control-plane result. No change was saved.';
          throw error;
        }
      } catch(error) {
        if(error.diagnostic?.version==='control-routing-failure.v1') {
          const failed=await store.addInteraction({raw_text:'[routing failed; request content omitted]',route:{route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'low',plain_summary:'Routing failed. No change was saved.',diagnostic:error.diagnostic,outcome_status:'failed'}});
          error.interaction_id=failed.id;
        }
        throw error;
      }
      if (Object.hasOwn(candidate,'prior_state')) throw new Error('Prior-state gate receipt is assigned by the control service');
      if(readOnly&&(candidate.proposal||candidate.route_kind!=='temporary_context'||candidate.responsibility!=='ai_can_handle')) {
        const error=new RouteValidationError('proposal','Read-only assessment cannot propose or authorize an action');
        error.code='read_only_route_violation';error.status=422;error.message='Routing proposed an action for a read-only question. No approval or change was saved.';
        throw error;
      }
      const route=enforceResolvedWriteTarget({...candidate,triage,prior_state:snapshot.prior_state,...(snapshot.completion_authority?{retrieval_authority:{source:snapshot.completion_authority.source,routing_source:snapshot.completion_authority.routing_source}}:{})},snapshot.prior_state,ambiguity_gate);
      if(route.proposal) {
        const reviewed=route.proposal.target_path==='ACTIVE_WORK.md'?snapshot.source:await github.readFile(route.proposal.target_repo,route.proposal.target_path);
        if(!reviewed.sha) throw new CanonicalWriteError('canonical_review_missing','Mary Kate could not verify the proposal source version. Nothing was queued.');
        route.proposal.reviewed_sha=reviewed.sha;
      }
      mark('safety',{route_kind:route.route_kind,mutation_proposed:Boolean(route.proposal)});
      const interaction=await store.addInteraction({raw_text:text.trim(),route:{...route,retrieval_trace:trace}});
      let item=null;
      if(route.proposal) item=await store.addQueueItem({interaction_id:interaction.id,...route});
      const handoff=item
        ? {status:'tracked',can_clear:true,message:route.responsibility==='needs_ashley'?'This is saved in Needs your attention until you approve or reject it.':'This is saved as an unreviewed AI suggestion, separate from today’s priorities. No worker has started.'}
        : {status:'conversation_active',can_clear:false,message:'This is still a conversation. No task or GitHub change has been claimed.'};
      mark('response',{response_type:route.route_kind,queue_item_created:Boolean(item)});
      try {observe(trace);} catch { /* Diagnostics must not alter authorization or availability. */ }
      return {retrieval_trace:trace,interaction_id:interaction.id,conversation_id:conversationId,plain_summary:route.plain_summary,...(technicalSummary?{technical_summary:technicalSummary}:{}),responsibility:route.responsibility,route_kind:route.route_kind,queue_item:item,handoff,triage,...(route.model_selection?{model_selection:route.model_selection}:{model_selection:{provider:'workers-ai',calls:1,task:triage.mode}})};
      } catch(error) {mark('failure',{code:error?.code||'invalid_request',first_failed_stage:trace.stages.at(-1)?.stage});error.retrieval_trace=trace;try {observe(trace);} catch {} throw error;}
    },
    async approve(id,note='') {
      const item=await store.getQueueItem(id);
      if(!item||!['pending','approved'].includes(item.status)||!item.proposal) throw new Error('Pending item not found');
      const target={repo:item.proposal.target_repo,path:item.proposal.target_path};
      const current=await github.readFile(target.repo,target.path);
      const payload_digest=await hash(canonicalPayload(target,item.proposal));
      const existing=readMarker(current.content);
      let updated,write,recovered=false,commit_sha=null;
      if(existing?.operation_id===item.id) {
        if(existing.payload_digest!==payload_digest) throw new CanonicalWriteError('operation_identity_conflict','Mary Kate stopped: this approval ID is attached to different change details. Nothing was written.');
        const core=stripMarker(current.content);
        if(existing.target_repo!==target.repo||existing.target_path!==target.path||existing.content_digest!==await hash(core)) throw new CanonicalWriteError('canonical_write_conflict','Mary Kate could not verify the previously approved change. Nothing new was written.');
        updated=current.content;
        recovered=true;
        commit_sha=await github.findFileCommit(target.repo,target.path,current.sha);
        if(!commit_sha) throw new CanonicalWriteError('canonical_provenance_unavailable','Mary Kate found the prior change but could not verify its GitHub provenance. Nothing new was written.',502);
      } else {
        if(item.status==='approved') throw new CanonicalWriteError('canonical_receipt_not_verified','Mary Kate has an operational receipt but GitHub does not verify this change. Nothing new was written.');
        if(!item.proposal.reviewed_sha) throw new CanonicalWriteError('canonical_review_missing','Mary Kate cannot verify the source version reviewed for this pending approval. Prepare a fresh proposal before approving. Nothing was written.');
        if(current.sha!==item.proposal.reviewed_sha) {
          if(target.path==='ACTIVE_WORK.md') await store.invalidateContextPacket('active-work.v1');
          throw new CanonicalWriteError('canonical_review_stale','Project Truth changed after this proposal was prepared. Review a fresh proposal before approving. Nothing was written.');
        }
        const canonical=applyProposal(stripMarker(current.content),item.proposal);
        const operation={version:'control-write-operation.v1',operation_id:item.id,payload_digest,expected_prior_sha:current.sha,target_repo:target.repo,target_path:target.path,content_digest:await hash(canonical)};
        updated=canonical.trimEnd()+'\n\n'+markerStart+encodeMarker(operation)+markerEnd+'\n';
        write=await github.writeFile(target.repo,target.path,updated,current.sha,'Control plane: '+item.plain_summary);
        commit_sha=write.commit_sha;
      }
      let readback;
      try { readback=await github.readFile(target.repo,target.path); } catch {
        const receipt={version:'control-write-receipt.v1',status:'failed',target,source_before_sha:current.sha,commit_sha,github_content_sha:write?.content_sha||current.sha,operation_id:item.id,payload_digest,verification:{status:'unavailable',verified_at:new Date(now()).toISOString()}};
        await store.resolveQueueItem(id,'failed','Write completed but canonical read-back was unavailable',receipt);
        if(target.path==='ACTIVE_WORK.md') await store.invalidateContextPacket('active-work.v1');
        throw new Error('GitHub write did not pass canonical read-back verification');
      }
      const verified=readback.content===updated&&(!write||readback.sha===write.content_sha)&&Boolean(commit_sha);
      const receipt={version:'control-write-receipt.v1',status:verified?'verified':'failed',target,source_before_sha:existing?.expected_prior_sha||current.sha,commit_sha,github_content_sha:write?.content_sha||current.sha,operation_id:item.id,payload_digest,recovered,verification:{status:verified?'verified':'mismatch',verified_at:new Date(now()).toISOString(),readback_sha:readback.sha||null}};
      if(!verified) {
        await store.resolveQueueItem(id,'failed','Canonical read-back did not match the approved proposal',receipt);
        if(target.path==='ACTIVE_WORK.md') await store.invalidateContextPacket('active-work.v1');
        throw new Error('GitHub write did not pass canonical read-back verification');
      }
      await store.resolveQueueItem(id,'approved',note,receipt);
      if(target.path==='ACTIVE_WORK.md') await store.invalidateContextPacket('active-work.v1');
      return {status:'approved',plain_summary:item.plain_summary,receipt,message:recovered?'Mary Kate confirmed that this approved change was already completed in GitHub. It did not write it again.':'Mary Kate made the approved change and confirmed the exact result in GitHub.'};
    },
    async reject(id,note='') {
      const item=await store.getQueueItem(id);
      if(!item||item.status!=='pending') throw new Error('Pending item not found');
      await store.resolveQueueItem(id,'rejected',note,null);
      return {status:'rejected',plain_summary:item.plain_summary};
    }
  };
}
export function createD1Store(db,{id=()=>crypto.randomUUID(),now=()=>new Date().toISOString()}={}) {
  const parse=row=>row?{...row,proposal:row.proposal_json?JSON.parse(row.proposal_json):null,route:row.route_json?JSON.parse(row.route_json):null,receipt:row.technical_receipt_json?JSON.parse(row.technical_receipt_json):null}:null;
  return {
    async getContextPacket(key){const row=await db.prepare('SELECT payload_json FROM control_context_packets WHERE packet_key=? AND invalidated_at IS NULL AND expires_at>?').bind(key,now()).first();return row?JSON.parse(row.payload_json):null;},
    async putContextPacket(key,packet){await db.prepare('INSERT INTO control_context_packets (packet_key,payload_json,created_at,expires_at,invalidated_at) VALUES (?,?,?,?,NULL) ON CONFLICT(packet_key) DO UPDATE SET payload_json=excluded.payload_json,created_at=excluded.created_at,expires_at=excluded.expires_at,invalidated_at=NULL').bind(key,JSON.stringify(packet),packet.created_at,packet.expires_at).run();},
    async invalidateContextPacket(key){await db.prepare('UPDATE control_context_packets SET invalidated_at=? WHERE packet_key=?').bind(now(),key).run();},
    async addInteraction(x){const key=id(),at=now();await db.prepare('INSERT INTO control_interactions (id,raw_text,route_json,plain_summary,project_id,route_kind,responsibility,confidence,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(key,x.raw_text,JSON.stringify(x.route),x.route.plain_summary,x.route.project_id||null,x.route.route_kind,x.route.responsibility,x.route.confidence,at).run();return{id:key,created_at:at};},
    async addQueueItem(x){const key=id(),at=now();await db.prepare('INSERT INTO control_queue_items (id,interaction_id,responsibility,status,plain_summary,why,proposal_json,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(key,x.interaction_id,x.responsibility,'pending',x.plain_summary,x.why||null,JSON.stringify(x.proposal),at).run();return{id:key,status:'pending',responsibility:x.responsibility,plain_summary:x.plain_summary};},
    async getQueueItem(key){return parse(await db.prepare('SELECT * FROM control_queue_items WHERE id=?').bind(key).first());},
    async resolveQueueItem(key,status,note,receipt){await db.prepare('UPDATE control_queue_items SET status=?,resolution_note=?,technical_receipt_json=?,resolved_at=? WHERE id=?').bind(status,note||null,receipt?JSON.stringify(receipt):null,now(),key).run();},
    async listQueues(){const rows=(await db.prepare("SELECT * FROM control_queue_items WHERE status='pending' ORDER BY created_at DESC").all()).results||[];return{needs_ashley:rows.filter(x=>x.responsibility==='needs_ashley').map(parse),ai_can_handle:rows.filter(x=>x.responsibility==='ai_can_handle').map(parse)};},
    async listHistory(limit){const rows=(await db.prepare('SELECT i.id,i.route_json,i.plain_summary,i.route_kind,i.responsibility,i.created_at,q.status AS outcome_status,q.resolved_at,q.technical_receipt_json FROM control_interactions i LEFT JOIN control_queue_items q ON q.interaction_id=i.id ORDER BY i.created_at DESC LIMIT ?').bind(limit).all()).results||[];return rows.map(({route_json,...row})=>{const route=JSON.parse(route_json||'{}');return {...row,outcome_status:route.outcome_status||row.outcome_status||'captured',diagnostic:route.diagnostic||null,...(route.model_selection?{model_selection:route.model_selection}:{}),receipt:row.technical_receipt_json?JSON.parse(row.technical_receipt_json):null};});}
  };
}
export function createMemoryStore({now=()=>new Date().toISOString()}={}) {
  const interactions=[],items=[],packets=new Map();
  return {
    async getContextPacket(key){const packet=packets.get(key);if(!packet||packet.invalidated_at||Date.parse(packet.expires_at)<=Date.parse(now()))return null;return structuredClone(packet);},
    async putContextPacket(key,packet){packets.set(key,structuredClone(packet));},
    async invalidateContextPacket(key){const packet=packets.get(key);if(packet)packet.invalidated_at=now();},
    async addInteraction(x){const row={id:'i'+(interactions.length+1),created_at:new Date().toISOString(),...x};interactions.push(row);return row;},
    async addQueueItem(x){const row={id:'q'+(items.length+1),status:'pending',...x};items.push(row);return row;},
    async getQueueItem(id){return items.find(x=>x.id===id)||null;},
    async resolveQueueItem(id,status,note,receipt){Object.assign(items.find(x=>x.id===id),{status,resolution_note:note,receipt,resolved_at:now()});},
    async listQueues(){return{needs_ashley:items.filter(x=>x.status==='pending'&&x.responsibility==='needs_ashley'),ai_can_handle:items.filter(x=>x.status==='pending'&&x.responsibility==='ai_can_handle')};},
    async listHistory(limit){return interactions.slice(-limit).reverse().map(row=>{const item=items.find(x=>x.interaction_id===row.id);return {...row,outcome_status:row.route?.outcome_status||item?.status||'captured',diagnostic:row.route?.diagnostic||null,resolved_at:item?.resolved_at||null,receipt:item?.receipt||null};});}
  };
}
