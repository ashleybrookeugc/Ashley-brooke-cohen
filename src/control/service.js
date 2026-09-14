import {applyProposal,parseActiveWork,validateRoute,WRITE_REPO} from './contracts.js';

export function createControlService({github,router,store}) {
  const state = async () => {
    const source=await github.readFile(WRITE_REPO,'ACTIVE_WORK.md');
    return {projects:parseActiveWork(source.content),source:{repo:WRITE_REPO,path:'ACTIVE_WORK.md',sha:source.sha},queues:await store.listQueues(),history:await store.listHistory(20)};
  };
  return {
    state,
    async capture(text) {
      if(typeof text!=='string'||!text.trim()||text.length>4000) throw new Error('Message must be 1–4000 characters');
      const snapshot=await state();
      const route=validateRoute(await router.route(text.trim(),{projects:snapshot.projects}));
      const interaction=await store.addInteraction({raw_text:text.trim(),route});
      let item=null;
      if(route.proposal) item=await store.addQueueItem({interaction_id:interaction.id,...route});
      return {interaction_id:interaction.id,plain_summary:route.plain_summary,responsibility:route.responsibility,route_kind:route.route_kind,queue_item:item};
    },
    async approve(id,note='') {
      const item=await store.getQueueItem(id);
      if(!item||item.status!=='pending'||!item.proposal) throw new Error('Pending item not found');
      const current=await github.readFile(item.proposal.target_repo,item.proposal.target_path);
      const updated=applyProposal(current.content,item.proposal);
      const receipt=await github.writeFile(item.proposal.target_repo,item.proposal.target_path,updated,current.sha,'Control plane: '+item.plain_summary);
      await store.resolveQueueItem(id,'approved',note,receipt);
      return {status:'approved',plain_summary:item.plain_summary,receipt};
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
    async addInteraction(x){const key=id(),at=now();await db.prepare('INSERT INTO control_interactions (id,raw_text,route_json,plain_summary,project_id,route_kind,responsibility,confidence,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(key,x.raw_text,JSON.stringify(x.route),x.route.plain_summary,x.route.project_id||null,x.route.route_kind,x.route.responsibility,x.route.confidence,at).run();return{id:key,created_at:at};},
    async addQueueItem(x){const key=id(),at=now();await db.prepare('INSERT INTO control_queue_items (id,interaction_id,responsibility,status,plain_summary,why,proposal_json,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(key,x.interaction_id,x.responsibility,'pending',x.plain_summary,x.why||null,JSON.stringify(x.proposal),at).run();return{id:key,status:'pending',responsibility:x.responsibility,plain_summary:x.plain_summary};},
    async getQueueItem(key){return parse(await db.prepare('SELECT * FROM control_queue_items WHERE id=?').bind(key).first());},
    async resolveQueueItem(key,status,note,receipt){await db.prepare('UPDATE control_queue_items SET status=?,resolution_note=?,technical_receipt_json=?,resolved_at=? WHERE id=?').bind(status,note||null,receipt?JSON.stringify(receipt):null,now(),key).run();},
    async listQueues(){const rows=(await db.prepare("SELECT * FROM control_queue_items WHERE status='pending' ORDER BY created_at DESC").all()).results||[];return{needs_ashley:rows.filter(x=>x.responsibility==='needs_ashley').map(parse),ai_can_handle:rows.filter(x=>x.responsibility==='ai_can_handle').map(parse)};},
    async listHistory(limit){return (await db.prepare('SELECT id,plain_summary,route_kind,responsibility,created_at FROM control_interactions ORDER BY created_at DESC LIMIT ?').bind(limit).all()).results||[];}
  };
}

export function createMemoryStore() {
  const interactions=[],items=[];
  return {
    async addInteraction(x){const row={id:'i'+(interactions.length+1),created_at:new Date().toISOString(),...x};interactions.push(row);return row;},
    async addQueueItem(x){const row={id:'q'+(items.length+1),status:'pending',...x};items.push(row);return row;},
    async getQueueItem(id){return items.find(x=>x.id===id)||null;},
    async resolveQueueItem(id,status,note,receipt){Object.assign(items.find(x=>x.id===id),{status,resolution_note:note,receipt});},
    async listQueues(){return{needs_ashley:items.filter(x=>x.status==='pending'&&x.responsibility==='needs_ashley'),ai_can_handle:items.filter(x=>x.status==='pending'&&x.responsibility==='ai_can_handle')};},
    async listHistory(limit){return interactions.slice(-limit).reverse();}
  };
}
