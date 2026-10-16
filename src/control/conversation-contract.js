// Conversation semantics, never permission or action authority.
const historicalQuestion=input=>/\b(?:histor(?:y|ical)|previous(?:ly)?|earlier|past|last (?:week|month|time)|used to|prior|what went wrong|what happened|why did)\b/i.test(input);
const historySource=(source,kind)=>kind==='failure'||/\/failures\/|SESSION_AND_FAILURE_PROTOCOL\.md$/.test(source?.path||'');
const currentFields=['Current','Current stage','Current assessment','Current blocker'];
const footer='This is still a conversation. No task or GitHub change has been claimed.';

export function compileConversationEvidence(context,input) {
  const retrieval=context.retrieval_evidence,includeHistory=historicalQuestion(input);
  const sources=retrieval?.sources||[],archived=sources.filter(s=>historySource(s.source,retrieval.authority_kind));
  const fields=[];let used=0;
  for(const project of context.active_work?.projects||[]) {
    for(const label of currentFields) {
      const text=project[label];
      // Keep qualifications whole. A large ledger field is not a short fact.
      if(typeof text!=='string'||text.length>600||used+text.length>1800)continue;
      fields.push({project:project.name,label,text,source:context.active_work.source});used+=text.length;
    }
  }
  return {
    intent:context.intent,ambiguity_gate:context.ambiguity_gate,freshness:context.freshness,
    conversation_contract:{version:'founder-conversation.v1',speaker:'Mary Kate product assistant',user:{name:'Ashley',role:'founder_and_user',implementation_owner:'AI workers'},permission_authority:false,
      current_status_basis:'Freshly retrieved saved fields are saved assertions, not a live runtime test.',
      historical_status_basis:'Failure records and previous assistant replies cannot establish a current failure.',
      historical_detail_requested:includeHistory},
    current_saved_state:fields,
    ...(retrieval?{retrieval_evidence:{...retrieval,sources:sources.filter(s=>!historySource(s.source,retrieval.authority_kind)).map(s=>({...s,temporal_role:'saved_reference'})),
      historical_references:archived.map(s=>({source:s.source,temporal_role:'historical_only',...(includeHistory?{excerpts:s.excerpts}:{})})),
      current_failure_verified:false}}:{}),
    ...(context.completion_authority?{completion_authority:context.completion_authority}:{}),
    ...(!retrieval&&!context.completion_authority?{prior_state:context.prior_state}:{}),
  };
}

function developerAttribution(text,input) {
  const technicalExplanationRequested=/\b(?:explain|teach|show|walk me through)\b.{0,100}\b(?:source code|implementation|code|function|test harness)\b/i.test(input);
  const clauses=String(text).replace(/[’‘]/g,"'").split(/(?<=[.!?])\s+|\n+/);
  return clauses.some(clause=>{
    if(/\b(?:you (?:do not|don't|need not|needn't) (?:need|have) to|you (?:should not|shouldn't) have to|not your (?:job|responsibility|fault)|without (?:requiring |making )?you)\b/i.test(clause))return false;
    return /\byou(?:'re| are| were| have been)\s+(?:(?:currently|still)\s+)?(?:(?:trying|planning|attempting) to\s+|working on\s+)?(?:develop(?:ing)?|implement(?:ing)?|debug(?:ging)?|design(?:ing)?|build(?:ing)?|test(?:ing)?)\b.{0,100}\b(?:chatbot|software|backend|system|code|app)\b/i.test(clause)
      || /\byou(?:'re| are)\s+(?:a |the )?(?:developer|engineer|programmer|coder)\b/i.test(clause)
      || /\b(?:what|which|tell me|describe|clarify)\b.{0,150}\b(?:steps|aspects|features|process)\b.{0,150}\b(?:you|your)\b.{0,150}\b(?:develop|implement|design|code|replicate|test)\w*\b/i.test(clause)
      || /\byou(?:'ve| have| haven't| have not| didn't| did not)\s+(?:(?:adequately|properly|thoroughly)\s+)?(?:tested|implemented|debugged|coded|built)\b.{0,100}\b(?:backend|system|code|software)\b/i.test(clause)
      || /\byour (?:coding|implementation|development|backend|code|testing) (?:process|approach|steps|work)\b/i.test(clause)
      || !technicalExplanationRequested&&/^(?:\s*[-*]\s*)?(?:review|inspect|study|understand)\b.{0,90}\b(?:implementation|source code|acceptance rows|development process|testing status)\b/i.test(clause)
      || /\b(?:contact|reach(?:ing)? out to|ask)\b.{0,70}\b(?:developers|maintainers|engineering team)\b/i.test(clause);
  });
}

function unverifiedPresentFailure(text,input) {
  const clauses=String(text).split(/(?<=[.!?])\s+|\n+/);
  return clauses.some(clause=>{
    const present=/\b(?:still|currently|now|continues?|remains?|is|are|has)\b/i.test(clause);
    const historical=/\b(?:previously|historical|earlier|past|older|at the time|was|were|had)\b/i.test(clause)&&! /\b(?:still|currently|now|continues?|remains?)\b/i.test(clause);
    const diagnostics=clause.match(/\b(?:HTTP\s*)?[45]\d{2}\b|\b(?:prior_state|routing_contract|read_only_route)_[a-z_]+\b/gi)||[];
    const reported=/\b(?:you (?:reported|report|saw|are seeing)|your (?:report|screenshot)|as you (?:reported|described))\b/i.test(clause)
      && diagnostics.every(code=>String(input).toLowerCase().includes(code.toLowerCase().replace(/^HTTP\s*/i,'')));
    const uncertain=/\b(?:cannot|can't|do not know|don't know|unverified|not (?:yet )?(?:confirmed|verified)|whether|may|might)\b/i.test(clause);
    const legacy=/\b(?:prerequisite scan|historical Current\/Next|development branch|deployment (?:is |was )?not authorized|full text as history|retained chat conversations)\b/i.test(clause);
    return present&&!historical&&!reported&&!uncertain&&(diagnostics.length>0||legacy);
  });
}

export function enforceConversationAnswer(answer,context={},input='') {
  const text=String(answer).replaceAll(footer,'').trim();
  const roleViolation=developerAttribution(text,input),historyViolation=unverifiedPresentFailure(text,input);
  if(!roleViolation&&!historyViolation)return {text,guard:{version:'founder-conversation.v1',status:'passed'}};
  const reasons=[...(roleViolation?['developer_role_attribution']:[]),...(historyViolation?['unverified_present_failure']:[])];
  const parts=[];
  if(roleViolation)parts.push("You're the founder using Mary Kate. Implementing and debugging the product belongs to the AI workers; I should not ask you to reconstruct a development process or blame your requirements or testing.");
  if(historyViolation)parts.push('The saved notes describe earlier failures. They do not prove those problems still exist on the current version; that needs a fresh check.');
  return {text:parts.join('\n\n'),guard:{version:'founder-conversation.v1',status:'abstained',reasons,current_failure_verified:false}};
}

export function conversationTurns(turns,context,input) {
  return (turns||[]).filter(turn=>['user','assistant'].includes(turn.role)&&typeof turn.content==='string').map(({role,content})=>({role,content:role==='assistant'?enforceConversationAnswer(content,context,input).text:content}));
}
