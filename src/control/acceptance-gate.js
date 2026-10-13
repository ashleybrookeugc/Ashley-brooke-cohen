const requiredBoolean = (value) => value === true;

/**
 * A small, deterministic release gate for founder requirements. It intentionally
 * does not infer a pass from code, a test count, or a worker's own report.
 */
export function evaluateAcceptanceGate({requirements = [], evidence = {}} = {}) {
  const missing = [];
  if (requirements.length < 7) missing.push('The original V1 requirements are incomplete.');
  const ids = new Set();
  for (const requirement of requirements) {
    if (!requirement?.id || !requirement?.authority || !requirement?.acceptance_test) {
      missing.push('A founder requirement is missing its authority or acceptance test.');
      continue;
    }
    if (ids.has(requirement.id)) {
      missing.push(`Requirement ${requirement.id} is duplicated.`);
      continue;
    }
    ids.add(requirement.id);
    if (evidence.tests?.[requirement.id] !== 'passed') {
      missing.push(`${requirement.id} has not passed its mapped acceptance test.`);
    }
  }
  if (!requiredBoolean(evidence.current_state_reconciled)) missing.push('Current-state reconciliation is not verified.');
  if (!requiredBoolean(evidence.plain_language_checked)) missing.push('Plain-language presentation is not verified.');
  if (!requiredBoolean(evidence.handoff_checked)) missing.push('Worker handoff did not preserve the requirements.');
  if (!requiredBoolean(evidence.independent_acceptance)) missing.push('Independent user acceptance is not recorded.');
  return {
    version: 'mary-kate.acceptance-gate.v1',
    status: missing.length ? 'blocked' : 'passed',
    completion_claim_allowed: missing.length === 0,
    missing
  };
}
