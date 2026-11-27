const VAULT='ashleybrookeugc/research-vault';
const PRODUCT='ashleybrookeugc/Ashley-brooke-cohen';
const TOPIC='shared-capabilities/ai-workflows/';
const AUTHORITIES={
  roadmap:[VAULT,TOPIC+'MARY_KATE_IMPLEMENTATION_SEQUENCE.md'],
  contract:[VAULT,TOPIC+'MARY_KATE_WORKFLOW_CONTRACT.md'],
  registry:[VAULT,TOPIC+'MARY_KATE_WORKFLOW_REGISTRY.json'],
  product:[PRODUCT,'docs/CONTROL_PLANE_TEST_REGISTRY.md'],
};
const SHA=/^[a-f0-9]{40}$/;
const ID=/^[a-z][a-z0-9-]{0,79}$/;

async function readMilestone(github,milestone) {
  const readHeads=async()=>Object.fromEntries(await Promise.all([VAULT,PRODUCT].map(async repo=>[repo,await github.readMainRevision(repo)])));
  const revisions=await readHeads();
  if(!Object.values(revisions).every(sha=>SHA.test(sha))) throw new Error('Invalid authority revision');
  const files=Object.fromEntries(await Promise.all(Object.entries(AUTHORITIES).map(async ([key,[repo,path]])=>[key,await github.readFile(repo,path,revisions[repo])])));
  if(!Object.values(files).every(file=>SHA.test(file?.sha)&&typeof file.content==='string'&&file.content.trim())) throw new Error('Missing authority file');
  const registry=JSON.parse(files.registry.content);
  milestone=milestone??registry.active_milestone;
  if(!/^[1-5]$/.test(milestone??'')) throw new Error('No registered current milestone');
  milestone=String(milestone);
  const record=registry.milestone_acceptance?.[milestone];
  const criteria=record?.criteria;
  if(!criteria||typeof criteria!=='object'||Array.isArray(criteria)||!Object.keys(criteria).length||!Object.entries(criteria).every(([id,version])=>ID.test(id)&&Number.isSafeInteger(version)&&version>0)||!ID.test(record.resume_id||'')) throw new Error('Missing acceptance criteria or resume reference');
  const finalHeads=await readHeads();
  if(Object.keys(revisions).some(repo=>revisions[repo]!==finalHeads[repo])) throw new Error('Authority changed while checking');
  const authority={milestone,revisions,files:Object.fromEntries(Object.entries(files).map(([key,file])=>[key,file.sha])),criteria,resume_id:record.resume_id};
  return {authority, receipt:record.completion_receipt};
}

export async function readMilestoneAuthority(github,milestone) {
  return (await readMilestone(github,milestone)).authority;
}

export async function checkMilestoneAdvancement({github,milestone,receipt}) {
  let current;
  try { current=await readMilestoneAuthority(github,milestone); }
  catch { return {allowed:false,code:'authority_unavailable',message:'I couldn’t verify the current requirements. The milestone stays open.'}; }
  return reconcile(current,receipt);
}

function reconcile(current,receipt) {
  const snapshot=receipt?.authority;
  if(snapshot?.milestone!==current.milestone||snapshot.resume_id!==current.resume_id)
    return {allowed:false,code:'stale_resume',message:'The saved resume point changed. The milestone stays open.',current};

  // A registry update may concern another workflow. Only changes to this
  // milestone’s criteria and resume ID affect those receipts.
  const changedAuthorities=['roadmap','contract','product'].filter(key=>current.files[key]!==snapshot.files?.[key]);
  const evidence=receipt.evidence??{};
  const missing=Object.entries(current.criteria).filter(([id,version])=>snapshot.criteria?.[id]!==version||evidence[id]?.version!==version||evidence[id]?.result!=='passed'||typeof evidence[id].reference!=='string'||!evidence[id].reference.trim()).map(([id])=>id);
  const allowed=missing.length===0&&changedAuthorities.length===0;
  return {allowed,code:allowed?'current_requirements_covered':'reconciliation_required',message:allowed?'The recorded checks cover the current milestone requirements.':'The milestone stays open until the updated requirements and evidence are reconciled.',missing,changed_authorities:changedAuthorities,current};
}

// The runtime reads the receipt from the same pinned canonical registry as
// the criteria. Interaction text, the router and HTTP clients provide no proof.
export async function inspectMilestoneBoundary(github,milestone) {
  let checkpoint;
  try { checkpoint=await readMilestone(github,milestone); }
  catch { return {allowed:false,code:'authority_unavailable',message:'I couldn’t verify the current roadmap requirements. I left the milestone open.'}; }
  const {authority,receipt}=checkpoint;
  if(!receipt) return {allowed:false,code:'completion_evidence_missing',current:authority,missing:Object.keys(authority.criteria)};
  return reconcile(authority,receipt);
}
