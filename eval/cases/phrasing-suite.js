import {
  FROZEN_HOLDOUT_CASES, HOLDOUT_DOCUMENT, NO_ACTIVE_DOCUMENT,
  actionPhrases, codingTaskPhrase, conversationTaskPhrases, ellipticalCodingPhrase,
  ellipticalPriorityPhrase, emptyWorkDocument, keywordCollisionPhrases, mixedActionPhrases,
  mk, priorityFollowUps, priorityQuestions, priorityWorkDocument, readOnlyAdvicePhrases,
  readonlyDocument, readonlyEmptyFactsPhrase, readonlyExplicitProjection, readonlyMutationPhrases,
  readonlyNegative, readonlyPositive, readonlySingleSectionDocument, reasoningTaskPhrase,
  scopedPriorityPhrase, taskProfileContext,
} from './phrasing-fixtures.js';

const assertRef = 'file://assert-routing.js';
const focusIncludes = ['Video processing is the current focus', 'Review a real video from start to finish'];
const unrelatedExcludes = ['repaired chat', 'signed agreement'];

function scenario({id, kind, input, document, empty_facts, triageContext, context, phrases, expected}) {
  return {
    description: id,
    vars: {
      id, kind, expected,
      ...(input === undefined ? {} : {input}),
      ...(document === undefined ? {} : {document}),
      ...(empty_facts ? {empty_facts: true} : {}),
      ...(triageContext ? {triageContext} : {}),
      ...(context ? {context} : {}),
      ...(phrases ? {phrases} : {}),
    },
    assert: [{type: 'javascript', value: assertRef}],
  };
}

const captureBase = {calls: 0, queued: false, writes: 0, router_calls: 0, mode: 'priority_advice', read_only: true, max_model_calls: 0};

const cases = [];

for (const input of priorityQuestions) {
  const blocker = /blockers?|blocked/i.test(input);
  cases.push(scenario({
    id: `triage:${input}`,
    kind: 'triage',
    input,
    expected: {mode: 'priority_advice', read_only: true, max_model_calls: 0},
  }));
  cases.push(scenario({
    id: `capture:${input}`,
    kind: 'priority_capture',
    input,
    document: priorityWorkDocument,
    expected: {
      ...captureBase,
      reads: 1,
      summary_includes: blocker ? ['No specific blocker is saved for video processing'] : focusIncludes,
      summary_excludes: unrelatedExcludes,
    },
  }));
}

cases.push(scenario({
  id: 'capture:priority-follow-ups',
  kind: 'priority_sequence',
  document: priorityWorkDocument,
  // Promptfoo expands a top-level array var into separate cases, so the
  // sequence stays one JSON string and the provider parses it.
  phrases: JSON.stringify(['what to prioritize next', ...priorityFollowUps]),
  expected: {
    reads: 1,
    writes: 0,
    router_calls: 0,
    steps: [
      {calls: 0, mode: 'priority_advice'},
      {calls: 0, mode: 'priority_advice'},
      {
        calls: 0,
        mode: 'priority_advice',
        summary_includes: ['No specific blocker is saved for video processing'],
        summary_excludes: ['Next: Review'],
      },
      {calls: 0, mode: 'priority_advice'},
    ],
  },
}));

cases.push(scenario({
  id: 'capture:empty-work',
  kind: 'priority_capture',
  input: 'What should I prioritize?',
  document: emptyWorkDocument,
  expected: {...captureBase, summary_includes: ['could not find any current projects']},
}));

cases.push(scenario({
  id: 'capture:scoped-video-analyzer',
  kind: 'priority_capture',
  input: scopedPriorityPhrase,
  document: priorityWorkDocument,
  expected: {
    ...captureBase,
    summary_includes: ['Review a real video from start to finish'],
    summary_excludes: ['Check the repaired chat', 'signed agreement'],
  },
}));

for (const input of readOnlyAdvicePhrases) {
  cases.push(scenario({id: `triage-readonly:${input}`, kind: 'triage', input, expected: {read_only: true}}));
}
for (const input of actionPhrases) {
  cases.push(scenario({id: `triage-action:${input}`, kind: 'triage', input, expected: {read_only: false, mode: 'action', max_model_calls: 1}}));
}
for (const input of keywordCollisionPhrases) {
  cases.push(scenario({id: `triage-collision:${input}`, kind: 'triage', input, expected: {mode: 'conversation', read_only: true}}));
}

for (const input of conversationTaskPhrases) {
  cases.push(scenario({id: `task:${input}`, kind: 'task_profile', input, context: taskProfileContext, expected: {task: 'conversation'}}));
}
cases.push(scenario({id: `task:${codingTaskPhrase}`, kind: 'task_profile', input: codingTaskPhrase, context: taskProfileContext, expected: {task: 'coding'}}));
cases.push(scenario({id: `task:${reasoningTaskPhrase}`, kind: 'task_profile', input: reasoningTaskPhrase, context: taskProfileContext, expected: {task: 'reasoning'}}));
cases.push(scenario({id: `task:${ellipticalCodingPhrase}`, kind: 'task_profile', input: ellipticalCodingPhrase, context: taskProfileContext, expected: {task: 'coding'}}));
cases.push(scenario({
  id: 'triage:elliptical-priority-follow-up',
  kind: 'triage',
  input: ellipticalPriorityPhrase,
  triageContext: {lastRoute: {model_selection: {task: 'priority_advice'}}, recent: {truncated: false}},
  expected: {mode: 'priority_advice', read_only: true, max_model_calls: 0},
}));

for (const entry of FROZEN_HOLDOUT_CASES) {
  const expected = {status: entry.status};
  if (entry.reason) expected.reason = entry.reason;
  if (entry.section) expected.section = entry.section;
  cases.push(scenario({
    id: `ambiguity:${entry.id}`,
    kind: 'ambiguity',
    input: entry.text,
    document: entry.document === 'no-active' ? NO_ACTIVE_DOCUMENT : HOLDOUT_DOCUMENT,
    expected,
  }));
}

for (const input of readonlyPositive) {
  cases.push(scenario({
    id: `readonly:${input}`,
    kind: 'ambiguity',
    input,
    document: readonlyDocument,
    expected: {status: 'passed', section: mk},
  }));
}
for (const input of readonlyNegative) {
  cases.push(scenario({
    id: `readonly-negative:${input}`,
    kind: 'ambiguity',
    input,
    document: readonlyDocument,
    expected: {status: 'blocked'},
  }));
}
cases.push(scenario({
  id: 'readonly:empty-facts',
  kind: 'ambiguity',
  input: readonlyEmptyFactsPhrase,
  empty_facts: true,
  expected: {status: 'blocked'},
}));
cases.push(scenario({
  id: 'readonly:single-section',
  kind: 'ambiguity',
  input: readonlyEmptyFactsPhrase,
  document: readonlySingleSectionDocument,
  expected: {status: 'passed', section: mk},
}));
for (const input of readonlyMutationPhrases) {
  cases.push(scenario({
    id: `readonly-mutation:${input}`,
    kind: 'ambiguity',
    input,
    document: readonlyDocument,
    expected: {status: 'blocked'},
  }));
}
cases.push(scenario({
  id: 'readonly:explicit-projection',
  kind: 'ambiguity',
  input: readonlyExplicitProjection.input,
  document: readonlyDocument,
  expected: {section: readonlyExplicitProjection.section},
}));
for (const input of mixedActionPhrases) {
  cases.push(scenario({
    id: `readonly-mixed:${input}`,
    kind: 'ambiguity',
    input,
    document: readonlyDocument,
    expected: {status: 'blocked'},
  }));
}

export default cases;
