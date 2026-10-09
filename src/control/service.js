import {routingDiagnostic} from './diagnostics.js';
import {applyProposal,normalizeFactKey,parseActiveWork,parseCanonicalFacts,RouteValidationError,validateRoute,WRITE_REPO} from './contracts.js';
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
  return /^\s*(?:do you think|is|are|has|have|where|what|how|tell me|show me|give me|assess|evaluate)\b/i.test(normalizedInput(text))
    && /\b(?:v1|first version|status|stage|stand|complete|completed|completion|finished|ready|readiness)\b/.test(words)
    && !/\b(?:update|set|change|mark|approve|publish|send|delete|spend|transfer|remove|deploy|merge|buy|upload|execute|run|resume|continue|advance)\b/.test(words);
};
const sectionScore=(text,section)=>{
  const heading=section.split(' — ')[0].trim();
  const words=textWords(heading).trim().split(' ').filter(Boolean);
  const input=textWords(text);
  if(input.includes(' '+words.join(' ')+' ')) return words.length+100;
  // A partial project name is useful only when it identifies one section.
  const distinctive=words.filter(word=>word.length>2&&!['active','now','parallel','blocked','resumable','paused','waiting','ashley','current','project','work','system','operating','reconciliation','truth'].includes(word));
  return distinctive.filter(word=>input.includes(' '+word+' ')).length;
};
export function resolveAuthoritativeWorkstream(text, facts) {
  const sections=[...new Set(facts.map(f=>f.section))].filter(section=>section!=='document');
  const aliasInput=maryKateInput(text);
  const input=namesMaryKate(text)?(/\bmary kate\b/.test(aliasInput)?aliasInput:aliasInput.replace(/\bai operating system\b/g,'mary kate')):text;
  const scores=sections.map(section=>({section,score:sectionScore(input,section)}));
  if(namesMaryKate(text)&&readOnlyAssessment(text)) {
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
  if(!section||section==='document'||/^(?:session handoff rule|current active workstreams|current execution priority)$/i.test(section)) return false;
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
export function controlErrorResponse(error) {
  if (error instanceof PriorStateGateError) {
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
export function createControlTaskPacket(snapshot) {
  return {
    version:'control-task-packet.v1',
    purpose:'control_route',
    active_work:{projects:snapshot.projects,source:snapshot.source},
    freshness:snapshot.context,
    prior_state:snapshot.prior_state,
    ambiguity_gate:snapshot.ambiguity_gate,
    ...(snapshot.intent?{intent:snapshot.intent}:{}),
    ...(snapshot.completion_authority?{completion_authority:snapshot.completion_authority}:{})
  };
}
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
export function createControlService({github,router,store,now=()=>Date.now(),packetTtlMs=300000}) {
  const state = async ({refresh=false,requiredFacts=[],requiredFactKeys=[]}={}) => {
    const key='active-work.v1';
    if(refresh) await store.invalidateContextPacket(key);
    let packet=await store.getContextPacket(key);
    let reused=Boolean(packet);
    if(packet&&!Array.isArray(packet.facts)){packet=null;reused=false;}
    if(!packet){const source=await github.readFile(WRITE_REPO,'ACTIVE_WORK.md');const created_at=new Date(now()).toISOString();packet={projects:parseActiveWork(source.content),facts:parseCanonicalFacts(source.content),source:{repo:WRITE_REPO,path:'ACTIVE_WORK.md',sha:source.sha},created_at,expires_at:new Date(now()+packetTtlMs).toISOString()};await store.putContextPacket(key,packet);}
    const prior_state=createPriorStateReceipt(packet,requiredFacts.length?requiredFacts:requiredFactKeys);
    return {routing_diagnostics:{version:'control-routing-failure.v1',storage:'control_interactions.route_json'},ambiguity_gate:{version:'authoritative-ambiguity.v1'},projects:packet.projects,source:packet.source,context:{status:reused?'reused':'refreshed',created_at:packet.created_at,expires_at:packet.expires_at},fact_keys:[...new Set(packet.facts.map(f=>f.key))],prior_state,queues:await store.listQueues(),history:await store.listHistory(20)};
  };
  return {
    state,
    async capture(text,{requiredFactKeys=[]}={}) {
      if(typeof text!=='string'||!text.trim()||text.length>4000) throw new Error('Message must be 1–4000 characters');
      const initial=await state();
      // Scope each requested fact against the actual canonical facts, not the de-duplicated key list.
      const packet=await store.getContextPacket('active-work.v1');
      const ambiguity_gate=createAmbiguityGate(text,packet?.facts||[]);
      if(ambiguity_gate.status==='blocked') {
        const detail=ambiguity_gate.reason==='unbound_workstream_request'?'Mary Kate found more than one workstream and could not bind this request to one current workstream, so it changed nothing.':'Mary Kate could not bind this request to one current workstream, so it changed nothing.';
        throw new PriorStateGateError('ambiguous_scope',detail,{gate:'authoritative-ambiguity.v1',status:'blocked',evidence:[],blockers:[{reason:'ambiguous_scope',key:'workstream',facts:ambiguity_gate.candidates.map(section=>({section,label:'workstream'}))}]});
      }
      const readOnly=readOnlyAssessment(text);
      if(!Array.isArray(requiredFactKeys)) throw new PriorStateGateError('invalid_request','required_fact_keys must be an array of strings');
      const assessmentKeys=readOnly&&maryKateSection(ambiguity_gate.section)?[...new Set((packet?.facts||[]).filter(fact=>fact.section===ambiguity_gate.section&&['current-stage','current','current-assessment'].includes(fact.key)).map(fact=>fact.key))]:[];
      const scoped=requestedFacts(text,packet?.facts||[],initial.projects,[...requiredFactKeys,...(readOnly&&maryKateSection(ambiguity_gate.section)?assessmentKeys.length?assessmentKeys:['current-stage']:[])]);
      const snapshot=scoped.length?await state({requiredFacts:scoped}):initial;
      snapshot.ambiguity_gate=ambiguity_gate;
      if(readOnly) snapshot.intent='read_only_assessment';
      requirePriorState(snapshot.prior_state);
      if(readOnly&&maryKateSection(ambiguity_gate.section)&&/\b(?:v1|first version|complete|completed|completion|finished|ready|readiness)\b/.test(textWords(text))) snapshot.completion_authority=await retrieveCompletionAuthority(github);
      let candidate;
      try {
        const output=await router.route(text.trim(),createControlTaskPacket(snapshot));
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
      const route=enforceResolvedWriteTarget({...candidate,prior_state:snapshot.prior_state,...(snapshot.completion_authority?{retrieval_authority:{source:snapshot.completion_authority.source,routing_source:snapshot.completion_authority.routing_source}}:{})},snapshot.prior_state,ambiguity_gate);
      const interaction=await store.addInteraction({raw_text:text.trim(),route});
      let item=null;
      if(route.proposal) item=await store.addQueueItem({interaction_id:interaction.id,...route});
      return {interaction_id:interaction.id,plain_summary:route.plain_summary,responsibility:route.responsibility,route_kind:route.route_kind,queue_item:item};
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
    async listHistory(limit){const rows=(await db.prepare('SELECT i.id,i.route_json,i.plain_summary,i.route_kind,i.responsibility,i.created_at,q.status AS outcome_status,q.resolved_at,q.technical_receipt_json FROM control_interactions i LEFT JOIN control_queue_items q ON q.interaction_id=i.id ORDER BY i.created_at DESC LIMIT ?').bind(limit).all()).results||[];return rows.map(({route_json,...row})=>{const route=JSON.parse(route_json||'{}');return {...row,outcome_status:route.outcome_status||row.outcome_status||'captured',diagnostic:route.diagnostic||null,receipt:row.technical_receipt_json?JSON.parse(row.technical_receipt_json):null};});}
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
