// Evidence-based concept-lock gate. No semantic model can self-attest a PASS.
// Receipts must originate from an external verifier, not the candidate response.
export function evaluateUgcConceptGate({requiresCurrentResearch=false,receipts=[],requestStage='concept_lock'}={}) {
  if(requestStage!=='concept_lock') return {status:'not_applicable',allowed:true,missing:[]};
  const required=['brief','current_facts',...(requiresCurrentResearch?['recent_comparators','opening_analysis']:[]),'hook_comprehension','visual_premise'];
  const missing=required.filter(kind=>!receipts.some(r=>r?.kind===kind&&r?.status==='PROVEN'&&typeof r?.source==='string'&&r.source.trim()&&r?.verified_by==='independent'&&r?.scope==='current'));
  return {version:'ugc.concept-gate.v1',status:missing.length?'blocked':'passed',allowed:missing.length===0,missing};
}
