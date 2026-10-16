// Application policy, not a model confidence score or permission grant. A
// missed paraphrase falls back to an inert conversation, never a stronger model.
const normalize=value=>String(value||'').normalize('NFKC').replace(/[’‘]/g,"'").trim();
const actions='add|update|set|change|mark|approve|publish|ship|post|send|delete|spend|pay|purchase|transfer|remove|deploy|merge|buy|upload|execute|run|resume|continue|advance|save|capture|record|remember|switch|build|implement|fix|edit|schedule|cancel';
const command=new RegExp('^(?:(?:please|now|then|also)\\s+)*(?:(?:can|could|would|will)\\s+you\\s+)?(?:'+actions+')\\b','i');
function actionClause(input) {
  // Inspect clause starts rather than every verb: "Should I deploy?" is
  // advice; "Should I deploy? Deploy it." retains the action gates.
  return normalize(input).split(/[.!?;\n]+|,\s*(?:and|then)\s+|\b(?:and then|and|then|but)\s+/i)
    .map(clause=>clause.trim().replace(/^(?:i mean|to clarify|no)[,:\s]+/i,'').replace(/^for\s+[^,]+,\s*/i,''))
    .find(clause=>command.test(clause));
}
export const hasActionRequest=input=>Boolean(actionClause(input));
const question=text=>/^(?:(?:and|so|also|okay|ok)[,\s]+)?(?:(?:please|can you|could you|would you)\s+)?(?:what|which|where|when|why|how|is|are|does|do|should|could|would|tell me|show me|give me|help me|recommend|suggest|summari[sz]e|explain|assess|evaluate|compare)\b/i.test(text);
export function triageRequest(input,{recent,lastRoute}={}) {
  const text=normalize(input);
  const actionText=actionClause(text),action=Boolean(actionText);
  const interrogative=question(text)||/^(?:i mean|i meant|to clarify|my question is)\b/i.test(text)&&question(text.replace(/^(?:i mean|i meant|to clarify|my question is)[,:\s]+/i,''));
  const priorityTerms=/\b(?:prioriti[sz]e|priorities|priority|focus|attention|blockers?|blocked|workload|active (?:work|projects)|current (?:work|projects))\b/i.test(text);
  const nextAdvice=/\bwhat\s+(?:(?:should|could|do)\s+(?:i|we)\s+(?:do|work on|tackle)|to\s+(?:do|prioriti[sz]e|focus on|work on|tackle))\b/i.test(text)
    || /\bprioriti[sz]e\s+(?:all|my|the)\s+(?:project\s+)?tasks?\b/i.test(text)
    || /^(?:(?:and|so)[,\s]+)?(?:(?:can|could) you (?:tell me )?)?what(?:'s| is| should happen) (?:the )?next(?: step)?[?.!\s]*$/i.test(text);
  const priorityContinuation=lastRoute?.model_selection?.task==='priority_advice'
    && !recent?.truncated && /^(?:and\s+)?(?:which (?:one )?first|what about (?:the )?blockers|anything (?:else|blocked)|what next)[?.!\s]*$/i.test(text);
  const otherMeaning=/\b(?:camera|lens|autofocus|aperture|priority queue|css|thread priority|cpu|thinking effort)\b|\bwhat (?:does|do) .{0,50} mean\b|\bwhat is (?:a|an) (?:blocker|priority)\b/i.test(text);
  const localPriority=!action&&!otherMeaning&&(interrogative&&priorityTerms||nextAdvice||priorityContinuation);
  const greeting=!action&&/^(?:hi|hello|hey|thanks|thank you)[!.\s]*$/i.test(text);
  const mode=action?'action':localPriority?'priority_advice':greeting?'greeting':'conversation';
  return {version:'mary-kate.triage.v1',mode,read_only:!action,...(action?{action_scope_text:actionText}:{}),
    ...(priorityContinuation?{priority_followup:true}:{}),
    max_model_calls:localPriority||greeting?0:1,
    reason:action?'Action language retains existing scope and approval gates.':localPriority?'Read current work; no inference or mutation needed.':'Default to an inert answer; uncertainty does not authorize escalation.'};
}

export function modelTaskProfile(input,context={}) {
  if(!['read_only_advice','read_only_assessment'].includes(context.intent)) return 'action';
  // A short new question is not automatically a continuation of a difficult
  // previous job. Only explicit elliptical references inherit the prior topic.
  const text=normalize(input);
  const prior=context.recent_conversation?.turns?.filter(x=>x.role==='user').at(-1)?.content||'';
  const elliptical=/^(?:and (?:that|those)|what about (?:that|those)|why (?:that|those)|explain (?:that|those)|compare (?:them|those)|debug (?:it|that))[?.!\s]*$/i.test(text);
  const task=elliptical?text+' '+prior:text;
  // Looking up project status containing "code", "repair" or "analysis"
  // does not require a coding/reasoning specialist.
  if(/\b(?:status|stage|progress|prioriti[sz]e|priorities|blockers?|blocked|focus|attention)\b/i.test(text)
    && !/\b(?:debug|diagnose|compare|tradeoffs?|root cause)\b/i.test(text)) return 'conversation';
  if(/\b(?:debug|refactor|implement|write|fix|repair)\b.{0,70}\b(?:code|function|script|bug|test|program)\b|\b(?:code|function|script|bug|program)\b.{0,70}\b(?:debug|refactor|repair)\b/i.test(task)) return 'coding';
  if(/\b(?:compare|tradeoffs?|evaluate|analy[sz]e|root cause|reason through)\b/i.test(task)) return 'reasoning';
  return 'conversation';
}
