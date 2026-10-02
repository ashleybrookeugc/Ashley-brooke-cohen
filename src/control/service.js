import {applyProposal,normalizeFactKey,parseActiveWork,parseCanonicalFacts,validateRoute,WRITE_REPO} from './contracts.js';
const markerStart='<!-- mary-kate-control-write:';
const markerEnd='-->';
const encodeMarker=value=>btoa(unescape(encodeURIComponent(JSON.stringify(value)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const decodeMarker=value=>JSON.parse(decodeURIComponent(escape(atob(value.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-value.length%4)%4)))));
const markerPattern=/\n?<!-- mary-kate-control-write:([A-Za-z0-9_-]+)-->\s*$/;
const stripMarker=content=>String(content).replace(markerPattern,'').trimEnd()+'\n';
const readMarker=content=>{const match=String(content).match(markerPattern);if(!match)return null;try{return decodeMarker(match[1]);}catch{return null;}};
const hash=async value=>{const bytes=new TextEncoder().encode(value);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');};
const canonicalPayload=(target,proposal)=>JSON.stringify({target,proposal});
export class CanonicalWriteError extends Error {
  constructor(code,message,status=409){super(message);this.code=code;this.status=status;}
}
export class PriorStateGateError extends Error {
  constructor(code, detail) { super(detail); this.code=code; this.status=code==='conflict'?409:422; }
}
const requestedFactKeys = (text, facts, explicit=[]) => {
  if (!Array.isArray(explicit) || explicit.some(key => typeof key !== 'string')) throw new PriorStateGateError('invalid_request','required_fact_keys must be an array of strings');
  const words=' '+String(text || '').toLowerCase().replace(/[^a-z0-9]+/g,' ')+' ';
  const derived=facts.filter(f => words.includes(' '+f.key.replaceAll('-',' ')+' ')).map(f => f.key);
  return [...new Set([...explicit.map(normalizeFactKey).filter(Boolean),...derived])];
};
export function createPriorStateReceipt(packet, requiredFactKeys=[]) {
  const material=[packet.source];
  const evidence=[], blockers=[];
  for (const key of requiredFactKeys) {
    const matches=packet.facts.filter(f => f.key===key);
    const values=[...new Set(matches.map(f => f.value))];
    if (!matches.length) blockers.push({key,reason:'missing'});
    else if (values.length!==1) blockers.push({key,reason:'conflict',facts:matches.map(({id,value})=>({id,value}))});
    else evidence.push({...matches[0],source:packet.source});
  }
  return {gate:'prior-state.context-retrieval',status:blockers.length?'blocked':requiredFactKeys.length?'passed':'not_required',required_fact_keys:requiredFactKeys,material,evidence,blockers};
}
function requirePriorState(receipt) {
  if (receipt.status!=='blocked') return;
  const conflict=receipt.blockers.find(x=>x.reason==='conflict');
  if (conflict) throw new PriorStateGateError('conflict','Prior-state conflict for '+conflict.key+'; clarification is required');
  throw new PriorStateGateError('missing','Prior-state fact missing; clarification is required');
}
export function createControlTaskPacket(snapshot) {
  return {
    version:'control-task-packet.v1',
    purpose:'control_route',
    active_work:{projects:snapshot.projects,source:snapshot.source},
    freshness:snapshot.context,
    prior_state:snapshot.prior_state
  };
}
export function createControlService({github,router,store,now=()=>Date.now(),packetTtlMs=300000}) {
  const state = async ({refresh=false,requiredFactKeys=[]}={}) => {
    const key='active-work.v1';
    if(refresh) await store.invalidateContextPacket(key);
    let packet=await store.getContextPacket(key);
    let reused=Boolean(packet);
    if(packet&&!Array.isArray(packet.facts)){packet=null;reused=false;}
    if(!packet){const source=await github.readFile(WRITE_REPO,'ACTIVE_WORK.md');const created_at=new Date(now()).toISOString();packet={projects:parseActiveWork(source.content),facts:parseCanonicalFacts(source.content),source:{repo:WRITE_REPO,path:'ACTIVE_WORK.md',sha:source.sha},created_at,expires_at:new Date(now()+packetTtlMs).toISOString()};await store.putContextPacket(key,packet);}
    const prior_state=createPriorStateReceipt(packet,requiredFactKeys);
    return {projects:packet.projects,source:packet.source,context:{status:reused?'reused':'refreshed',created_at:packet.created_at,expires_at:packet.expires_at},fact_keys:[...new Set(packet.facts.map(f=>f.key))],prior_state,queues:await store.listQueues(),history:await store.listHistory(20)};
  };
  return {
    state,
    async capture(text,{requiredFactKeys=[]}={}) {
      if(typeof text!=='string'||!text.trim()||text.length>4000) throw new Error('Message must be 1–4000 characters');
      const initial=await state();
      const keys=requestedFactKeys(text,initial.fact_keys.map(key=>({key})),requiredFactKeys);
      const snapshot=keys.length?await state({requiredFactKeys:keys}):initial;
      requirePriorState(snapshot.prior_state);
      const candidate=validateRoute(await router.route(text.trim(),createControlTaskPacket(snapshot)));
      if (Object.hasOwn(candidate,'prior_state')) throw new Error('Prior-state gate receipt is assigned by the control service');
      const route={...candidate,prior_state:snapshot.prior_state};
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
    async listHistory(limit){const rows=(await db.prepare('SELECT i.id,i.plain_summary,i.route_kind,i.responsibility,i.created_at,q.status AS outcome_status,q.resolved_at,q.technical_receipt_json FROM control_interactions i LEFT JOIN control_queue_items q ON q.interaction_id=i.id ORDER BY i.created_at DESC LIMIT ?').bind(limit).all()).results||[];return rows.map(row=>({...row,outcome_status:row.outcome_status||'captured',receipt:row.technical_receipt_json?JSON.parse(row.technical_receipt_json):null}));}
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
    async listHistory(limit){return interactions.slice(-limit).reverse().map(row=>{const item=items.find(x=>x.interaction_id===row.id);return {...row,outcome_status:item?.status||'captured',resolved_at:item?.resolved_at||null,receipt:item?.receipt||null};});}
  };
}
