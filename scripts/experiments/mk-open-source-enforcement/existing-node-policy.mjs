import {evaluateAcceptanceGate} from '../../../src/control/acceptance-gate.js';
import {validateRoute} from '../../../src/control/contracts.js';

const targetKey=target=>target?`${target.repo}:${target.path}`:null;

function routeFor(target) {
  const proposal=target.path==='SIDE_IDEAS.md'
    ? {target_repo:target.repo,target_path:target.path,operation:'append_side_idea',title:'Fixture',body:'Fixture body',scope:'test'}
    : {target_repo:target.repo,target_path:target.path,operation:'replace_field',section:'Mary Kate / AI operating system',field:'Current stage',value:'Fixture'};
  return {route_kind:'state_update',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Fixture route',proposal};
}

export function evaluateExistingNodePolicy(input) {
  const violations=[];

  if(!input||typeof input!=='object'||Array.isArray(input)) return {allow:false,violations:['Policy input must be an object.']};
  if(typeof input.claim_completion!=='boolean') violations.push('claim_completion must be boolean.');
  if(!input.action||typeof input.action!=='object'||Array.isArray(input.action)) violations.push('action must be an object.');
  else if(!['none','github_write'].includes(input.action.type)) violations.push('action.type is invalid.');
  if(input.claim_completion&&(!Array.isArray(input.required_checks)||!input.check_results||typeof input.check_results!=='object'||Array.isArray(input.check_results))) {
    violations.push('Completion claims require required_checks and check_results.');
  }

  if(violations.length) return {allow:false,violations};

  if(input.claim_completion) {
    const required=input.required_checks.map(id=>({id,authority:`Structured fixture authority: ${id}`,acceptance_test:`fixture:${id}`}));
    while(required.length<14) {
      const id=`preserved_existing_requirement_${required.length+1}`;
      required.push({id,authority:'Existing preserved requirement',acceptance_test:`fixture:${id}`});
    }
    const tests=Object.fromEntries(required.map(item=>[item.id,input.required_checks.includes(item.id)?input.check_results[item.id]:'passed']));
    const gate=evaluateAcceptanceGate({requirements:required,evidence:{tests,current_state_reconciled:true,plain_language_checked:true,handoff_checked:true,independent_acceptance:true}});
    if(gate.status!=='passed') violations.push(...gate.missing);
  }

  if(input.action?.type==='github_write') {
    if(input.authorization?.approved!==true) violations.push('GitHub write lacks explicit approval.');
    if(targetKey(input.authorization?.approved_target)!==targetKey(input.action.target)) violations.push('GitHub write target differs from the approved target.');
    try { validateRoute(routeFor(input.action.target)); }
    catch(error) { violations.push(`Existing route contract rejected ${error.path||'route'}: ${error.reason||error.message}`); }
  }

  return {allow:violations.length===0,violations};
}

export async function enforceExistingNodePolicy(input,effect) {
  const decision=evaluateExistingNodePolicy(input);
  if(decision.allow) await effect();
  return decision;
}
