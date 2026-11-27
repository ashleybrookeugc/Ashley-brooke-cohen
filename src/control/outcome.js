// The signed control endpoint uses this fixed registry binding. Registry
// metadata is descriptive and cannot dispatch code or authorize a change.
export function projectRoutingOutcome(result, {error=false}={}) {
  const trace=result.retrieval_trace;
  const retrieval=trace?.stages.find(stage=>stage.stage==='retrieval');
  const boundary=trace?.stages.find(stage=>stage.stage==='milestone_freshness');
  const errorCode=error?result.code:null;
  const blocked=error&&/^prior_state_|_route_violation$/.test(errorCode||'');
  const needsDecision=!error&&result.handoff?.status==='tracked';
  const partial=!error&&Boolean(retrieval?.missing?.length);
  const status=error?(blocked?'blocked':'failed'):boundary&&!boundary.allowed?'blocked':needsDecision?'approval_needed':partial?'partial':'answered';
  const outcome=error
    ? blocked?result.error:'I couldn’t complete that request. No successful change was recorded.'
    : result.plain_summary;
  const next_action=error?result.action?.prompt??null:needsDecision?'Review the proposed change in Needs your attention.':null;
  return {
    ...result,
    user_view:{status,outcome,next_action,
      progress:error?null:result.handoff?.message??null,
      ...(partial?{blocker:'Some saved evidence was unavailable. This answer may be incomplete.'}:{})},
    agent_record:{workflow:'intent-routing',request_id:trace?.request_id??null,
      interaction_id:result.interaction_id??null,error_code:errorCode,
      evidence_source:trace?.request_id?'retrieval_trace':null,
      evidence_url:result.interaction_id?'/api/control/interactions/'+encodeURIComponent(result.interaction_id)+'/evidence':null}
  };
}
