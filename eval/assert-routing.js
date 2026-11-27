function includes(text, part) {
  return String(text || '').toLowerCase().includes(String(part).toLowerCase());
}

function compareStep(actual, expected, label, errors) {
  for (const key of ['mode', 'calls', 'read_only', 'max_model_calls', 'queued', 'status', 'reason', 'section', 'task', 'reads', 'writes', 'router_calls']) {
    if (expected[key] !== undefined && JSON.stringify(actual?.[key]) !== JSON.stringify(expected[key])) {
      errors.push(`${label}${key}: expected ${JSON.stringify(expected[key])} got ${JSON.stringify(actual?.[key])}`);
    }
  }
  for (const part of expected.summary_includes || []) {
    if (!includes(actual?.plain_summary, part)) errors.push(`${label}summary missing ${JSON.stringify(part)}`);
  }
  for (const part of expected.summary_excludes || []) {
    if (includes(actual?.plain_summary, part)) errors.push(`${label}summary contains ${JSON.stringify(part)}`);
  }
}

export default function assertRouting(output, context) {
  const actual = typeof output === 'string' ? JSON.parse(output) : output;
  const expected = context?.vars?.expected || {};
  const errors = [];
  compareStep(actual, expected, '', errors);
  if (Array.isArray(expected.steps)) {
    if (!Array.isArray(actual?.steps) || actual.steps.length !== expected.steps.length) errors.push(`steps: expected ${expected.steps.length} got ${actual?.steps?.length ?? 0}`);
    else expected.steps.forEach((step, index) => compareStep(actual.steps[index], step, `step ${index} `, errors));
  }
  if (errors.length) return {pass: false, score: 0, reason: `${context?.vars?.id || 'case'}: ${errors.join('; ')}`};
  return {pass: true, score: 1, reason: 'Local routing assertion passed'};
}
