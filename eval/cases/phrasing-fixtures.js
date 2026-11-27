// Frozen routing and triage phrases shared by the node tests and the local
// promptfoo suite. Expected decisions stay in the suites; this module does
// not call triage, the ambiguity gate, or a model.

export const priorityWorkDocument = `## Current focus
**Workstream:** Video analyzer
**Do next:** Review a real video from start to finish and improve the edit advice.
## Current active workstreams
### Video analyzer \u2014 ACTIVE / PARALLEL
**Next bounded action:** Verify the uploaded video.
### Mary Kate \u2014 ACTIVE NOW
**Next bounded action:** Check the repaired chat.
**Current assessment:** Production acceptance is unverified.
### B-Paid \u2014 BLOCKED
**Current blocker:** Waiting for the signed agreement.
## Session handoff rule
`;

export const priorityQuestions = Object.freeze([
  'what to prioritize next', 'What should I prioritize next?', 'What should I do today?',
  'Could you tell me what deserves my attention?', 'Help me decide what to focus on.',
  'Show me my current work.', 'Give me an overview of my active projects.',
  'What should we tackle next?', 'Which priorities are blocked?', 'What are our blockers?',
  'So, what should I focus on next?', 'What needs my attention today?',
  "What's next?", 'What\u2019s next?', 'Can you tell me what should happen next?',
]);

export const priorityFollowUps = Object.freeze([
  'Which one first?', 'And what about the blockers?', 'Anything else?',
]);

export const readOnlyAdvicePhrases = Object.freeze([
  'Should I deploy this?', 'How would you fix this bug?', 'Do not deploy anything.', 'I mean which model should I select?',
]);

export const actionPhrases = Object.freeze([
  'Please deploy it.', 'Can you update Video analyzer?', 'What are my priorities? Delete the old files.',
  'Tell me my priorities and then approve the proposal.', 'Show current work; send the report.', 'No, change Video analyzer stage.',
]);

export const keywordCollisionPhrases = Object.freeze([
  'Which camera focus setting should I use?', 'What is a priority queue?', 'What does blocked mean?', 'How does CSS priority work?',
]);

export const taskProfileContext = Object.freeze({
  intent: 'read_only_advice',
  recent_conversation: {turns: [{role: 'user', content: 'How should I debug this code?'}]},
});

export const conversationTaskPhrases = Object.freeze([
  'Hello', 'What is the status of the code repair?', 'What should I prioritize next?',
  'What does analysis mean?', 'I mean which model and thinking effort should I select?',
]);

export const codingTaskPhrase = 'How should I debug this code?';
export const reasoningTaskPhrase = 'Compare these options';
export const ellipticalCodingPhrase = 'What about that?';
export const ellipticalPriorityPhrase = 'Which one first?';

export const emptyWorkDocument = '# Empty work';
export const scopedPriorityPhrase = 'What should I prioritize for Video analyzer?';

export const HOLDOUT_DOCUMENT = ['# Active Work', '',
  '## Current active workstreams', '',
  '### Mary Kate / AI operating system \u2014 ACTIVE NOW', '**Current stage:** V1 proof', '**Next bounded action:** Verify the route',
  '### Shared video-understanding / evidence engine \u2014 ACTIVE / PARALLEL', '**Current stage:** Benchmark', '**Next bounded action:** Verify source identity',
  '### ContentEase / UGC Creator App \u2014 ACTIVE / PARALLEL', '**Current stage:** Media library', '**Next bounded action:** Inspect a rough cut',
  '### Ashley Brooke Cohen / professional website \u2014 ACTIVE / PARALLEL', '**Current stage:** Content system', '**Next bounded action:** Verify the public flow',
  '### B-Paid \u2014 WAITING FOR ASHLEY', '**Current stage:** Awaiting approval', '**Next bounded action:** Confirm the offer',
  '### Pop-Up Radar / event + casting discovery \u2014 PAUSED / RESUMABLE', '**Current stage:** Resume later', '**Next bounded action:** Verify the mobile flow',
  '', '## Session handoff rule'].join('\n');

export const NO_ACTIVE_DOCUMENT = ['# Active Work', '', '## Current active workstreams', '',
  '### B-Paid \u2014 WAITING FOR ASHLEY', '**Current stage:** Awaiting approval',
  '### Pop-Up Radar / event + casting discovery \u2014 PAUSED / RESUMABLE', '**Current stage:** Resume later',
  '', '## Session handoff rule'].join('\n');

// Generated independently of the guard. Keep these decisions frozen.
export const FROZEN_HOLDOUT_CASES = Object.freeze([
  {id: 'mk-next-plain', text: "What's next?", status: 'blocked', reason: 'unbound_workstream_request'},
  {id: 'video-next-paraphrase', text: 'Can you tell me what should happen next?', status: 'blocked', reason: 'unbound_workstream_request'},
  {id: 'ugc-current-action', text: 'What is the current action?', status: 'blocked', reason: 'unbound_workstream_request'},
  {id: 'website-advance', text: 'Advance the project.', status: 'blocked', reason: 'unbound_workstream_request'},
  {id: 'stale-temporal-continuation', text: 'Continue the completed Temporal thread.', status: 'blocked', reason: 'unbound_continuation'},
  {id: 'vague-assent', text: 'Yes, approve the old proposal.', status: 'blocked', reason: 'unbound_continuation'},
  {id: 'conflicting-cross-project-approval', text: 'Use Shared video-understanding / evidence engine to update Ashley Brooke Cohen / professional website.', status: 'blocked', reason: 'multiple_current_referents'},
  {id: 'explicit-mary-kate', text: 'Continue Mary Kate next.', status: 'passed', section: 'Mary Kate / AI operating system \u2014 ACTIVE NOW'},
  {id: 'explicit-video-switch', text: 'Switch to Shared video-understanding / evidence engine.', status: 'passed', section: 'Shared video-understanding / evidence engine \u2014 ACTIVE / PARALLEL'},
  {id: 'explicit-bpaid', text: 'What is next for B-Paid?', status: 'passed', section: 'B-Paid \u2014 WAITING FOR ASHLEY'},
  {id: 'ordinary-conversation', text: 'The rough cut needs another review.', status: 'passed', section: null},
  {id: 'missing-workstream-evidence', text: 'What should I do next?', status: 'blocked', reason: 'missing_workstream_context', document: 'no-active'},
]);

export const mk = 'Mary Kate / AI operating system \u2014 **ACTIVE NOW**';
export const readonlyPriority = 'Mary Kate / Project Truth reconciliation';
export const readonlyDocument = ['# Active Work', '## Current execution priority', `### ${readonlyPriority}`,
  '**Current stage:** Earlier reconciliation', '**Next bounded action:** Earlier canary',
  '## Current active workstreams', `### ${mk}`, '**Current:** V1 proof remains pending',
  '**Current assessment:** No V1 row is verified; production acceptance remains unproven.',
  '**Next bounded action:** Repair the explicit read-only question',
  '### Shared video-understanding / evidence engine \u2014 ACTIVE / PARALLEL', '**Current stage:** Media proof',
  '### ContentEase / UGC Creator App \u2014 ACTIVE / PARALLEL', '**Current stage:** Review',
  '## Session handoff rule'].join('\n');

export const readonlyPositive = Object.freeze([
  'Do you think v1 of mk is complete?',
  'Has MK reached V1 readiness?',
  'Is Mary Kate V1 complete?',
  'Give me a status assessment for MaryKate v1.',
  'Where does Mary-Kate V1 stand?',
  'Is the first version of our AI operating system finished?',
]);

export const readonlyNegative = Object.freeze([
  "What's next?", 'What\u2019s next?', 'Is MK or ContentEase ready?',
  'Is Mary Kate V1 complete compared with Shared video-understanding / evidence engine?',
  'Fine, carry on.',
]);

export const readonlyEmptyFactsPhrase = 'Is MK V1 complete?';
export const readonlySingleSectionDocument = `### ${mk}\n**Current stage:** Pending`;

export const readonlyMutationPhrases = Object.freeze([
  'Update Mary Kate current stage',
  'Update MK current stage',
]);

export const readonlyExplicitProjection = Object.freeze({
  input: 'For Mary Kate / Project Truth reconciliation, update current stage',
  section: readonlyPriority,
});

export const mixedActionPhrases = Object.freeze([
  'Is MK complete? Publish it.', 'Tell me whether MK is ready and delete the old assets.',
  'Can you mark MK complete?', 'Assess MK V1 and send the private footage.',
]);
