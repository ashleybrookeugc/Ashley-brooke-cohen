# Conversation triage — live repair (2026-10-16)

Founder request, 2026-10-15: make Mary Kate understand normal questions without
mistaking them for difficult jobs, wasting calls, or granting mutation permission.

## Reuse and scope

This extends the existing current-work projection, private conversation store,
tool-free text adapter, model eligibility/budget reservations and approval gates.
It does not install a new chat framework or change providers, accepted models,
credentials, spending settings, deployment, or the Project Truth authority map.
Founder authority remains research-vault
`research/ai-workflows/2026-10-04-mary-kate-founder-intent-decomposition.md`.
This is a bounded repair of existing triage, not a new inference framework.

## Three independent decisions

1. Request shape: explicit action, current-work advice, greeting, or conversation.
   Unknown language defaults to an inert conversation; a model cannot opt itself
   into permission. Explicit and mixed commands retain existing scope/write gates.
2. Retrieval: whole-workload priority questions use ACTIVE_WORK and its existing
   five-minute cache. Explicit project requests stay scoped; each recorded field
   used by the summary is checked for conflicting values within that project.
   A conversational "next" is not a global literal Next-field request.
3. Model task/cost: priority advice and greetings use zero inference calls.
   Other conversational requests offer no action tools. Automatic selection uses
   the current question; a short message no longer inherits a previous hard task
   unless it explicitly refers back to that topic. A status question about code
   repair is conversation, not coding. Genuine comparison/debugging still selects
   the existing accepted compatible specialist when automatic routing is enabled.

## Output and continuation

Priority summaries order ACTIVE NOW ahead of parallel projects, preserve other
recorded order, show up to five next steps and five blockers, and include blocked
and waiting projects in the blocker scan. Priority is a projection of recorded
state, not an invented schedule or deadline ranking. Missing records and open
proof remain explicit; partial tests never establish production success.

Private history preserves the current-work source SHA and zero-call receipt.
Named-project priority follow-ups retain that scope after rereading current facts;
the topic marker confers no approval authority. D1 history exposes only the model
selection marker needed for this continuation, not private raw input. Complete
questions beginning "And which/how/what..." are allowed to introduce new words;
unresolved nominal fragments such as "And Terra sol etc" still ask for meaning.

## Cost and safety boundaries

- No model call for classification, summaries of the priority packet, evaluation,
  or retries. No new dependency or live provider request during development tests.
- Existing automatic-router byte/token caps, atomic daily reservations, acceptance
  requirements, spending opt-in and pricing checks remain in force, unchanged.
- The legacy router also honors the one-call triage ceiling: a quota/capacity
  failure cannot trigger another provider. Its direct legacy API without a triage
  packet retains historical behavior for compatibility; the service always adds
  triage. Free-tier availability is not an unlimited-use guarantee.
- Ordinary answers never queue a proposal; hostile output still fails closed.
  Explicit changes still require a resolved target, reviewed source SHA, approval,
  version checks and canonical readback. None of those gates was removed.

## Evidence and limitations

`test/control-triage.test.js` exercises phrase variations, explicit scope,
follow-ups, real literal Next-field collisions, stale-cache refresh, source
conflicts, waiting-only/missing records, D1 continuation shape, zero/one provider
calls, no fallback, and hostile output. Provider responses are mocked; these
tests prove wiring/cost/safety boundaries, not the model's semantic quality.

The original pure ambiguity holdouts remain frozen. The service's former
unqualified "What's next?", "what should happen next?" and missing-workstream
next-advice blocks are explicitly superseded by the inert whole-workload answer;
new zero-call and waiting-only evidence tests cover that behavior.
Mutation/diagnostic fixtures now use explicit capture/update requests instead of
assuming a statement authorizes a proposal. All prior mutation assertions remain.

This remains application heuristics with an inexpensive read-only fallback, not
a general semantic-understanding guarantee. Unknown action paraphrases may ask
for clarification rather than execute. Arbitrary multi-topic continuity, indexed
deep-document retrieval and useful authenticated production answers require their
own acceptance evidence. The indexed retrieval repair was integrated with triage in product PR #44 and released through the normal main-to-Cloudflare path. The authenticated production check returned a current-priority answer, but its wording remains too technical for Ashley's acceptance.


## Current execution-priority contract (2026-10-15 America/New_York)

The released priority answer was freshly observed in the authenticated production
UI: it no longer returned 422, but selected an older project Next field and
repeated technical text. This repair uses the existing ACTIVE_WORK source,
parser, cache and prior-state validator; no skill installation or new model.

For an unscoped focus/next-action question, read these exact fields under
`## Current execution priority`: `Current objective`, `Next bounded action`,
and optional `Current blocker`. Source authors supply short plain language;
the renderer does not infer a ranking from dates, paraphrase, or cut off a
qualification. Once any contract field exists, both required fields must exist
and each selected fact must have one unambiguous value. Missing/conflicting
facts stop safely. A field over 600 characters produces an honest concise-summary
limitation instead of falling back to an older task or making an inference call.

Named-project questions and their scoped follow-ups retain their own authority.
Whole-project overviews and blocker scans retain the existing collection of
projects; a single focus must not erase them. Registries with none of the explicit
priority fields retain the tested legacy projection. Caller-required evidence,
mutation approval, allowlists, stale-SHA checks and canonical reread are unchanged.

The existing privacy-safe retrieval trace now records source SHA, section,
selected field keys and character count for this deterministic path. It records
no field values or raw conversation. The six new regression groups and the
[source-backed four-cell replay](test-receipts/2026-10-16-current-priority-authority.json)
separate source cleanup from code behavior. This is a reviewed development
candidate, not a new production acceptance claim. Full semantic routing,
dashboard reconciliation, broad readable answers and exact Worker lineage remain
separate work. Source contract fields must be maintained as derived current state
against product implementation evidence; their existence alone proves no outcome.

This borrows ICM's small job/input contract and walk-test discipline within the
existing linked architecture. Method stays in this document, facts in ACTIVE_WORK,
and verification in the receipt. No folder migration or filesystem orchestrator.

### Prior release evidence (unchanged)

Product PR [#44](https://github.com/ashleybrookeugc/Ashley-brooke-cohen/pull/44) merged to `main` at `dcce6e99e22f4d73d26893f3e3ae5c41515f450b`. GitHub's regression workflow #130 passed the full 185-test suite, requirement mapping and Worker packaging. An authenticated production Command Center session asked “What should I do today?” and received current saved-work priorities rather than the former 422. The visible answer is long and technical. The page did not expose the Worker version ID or actual inference counter, so the UI check does not independently prove exact runtime commit lineage or the live zero-call count. Live answer quality remains open.
