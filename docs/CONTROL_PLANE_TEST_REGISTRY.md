# Mary Kate V1 control-plane test registry

This is the product-local registry for the bounded routing and execution-acceptance work. It records test surfaces and evidence pointers; it does not authorize deployment, approval, canonical writes, publication, spending, transfer, or deletion.

## Canonical implementation state

- Canonical main remains `5df0a6d3d0b614f814e95a6dee740272e4c9cb74`, containing the earlier unbound-next implementation `ee38ac9606605c17e696e5cb3a704a00d5b4401c` and documentation receipts.
- Explicit-MK development implementation: `97e38b5848aa63bf7cc3825916a1af26d5d8c0a2` plus `2ada581e6f374ccf4dfa59faa37b817bde804375` on `mary-kate/explicit-readonly-resolution`. The published source was fetched and reread. This branch has not been merged or deployed.
- Published repair: `src/control/service.js`, `test/control-ambiguity-holdout.test.js`, and the original product failure record are included in `ee38ac9` and its parents. The receipt-only reconciliation commits follow that implementation commit on `main`; the exact current head is recorded by the final Git reread for this run.
- Product failure history: `docs/TROUBLESHOOTING_LOG.md`.
- Production boundary: `docs/CONTROL_PLANE.md` records the earlier GitHub read/route evidence and explicitly leaves the canonical write → reread → D1 receipt slice unproven.

## 2026-10-09 reconciliation and production boundary

- GitHub Actions control-plane regression run for `ee38ac9` completed successfully: [run #46](https://github.com/ashleybrookeugc/Ashley-brooke-cohen/actions/runs/37880842397). This verifies the repository test workflow, not Cloudflare traffic.
- An existing authenticated control-plane observation for exactly `What's next?` in a multiple-eligible-workstream context returned the ambiguity response `prior_state_ambiguous_scope`; the visible page showed no waiting approval item and no new matching recent-outcome row. No second request was submitted.
- The direct observation above is **PARTIAL / UNVERIFIED** because the served Worker lineage, exact zero model/router dispatches, before/after queue/history delta, and canonical-write absence were not available in this session. The latest canonical Project Truth registry now separately records the prior unbound `What's next?` canary as a production **PASS**; that canonical classification supersedes this session's limited direct observation, and no second unbound canary should be submitted.
- The same latest canonical state records a separate confirmed production **FAIL** for the explicit read-only request `Do you think v1 of mk is complete?`, which was unnecessarily blocked as ambiguous. Its repair/regression is now the next bounded Mary Kate acceptance gate; it must not weaken the unbound ambiguity boundary.
- Accessible 2026-10-08 Codex session records were reconciled into the checked-in artifacts and canonical Project Truth registry. Durable prompts/decisions, test inputs/results, failures, and commit provenance are preserved; unavailable hidden reasoning and full private transcripts are not claimed or copied.

## Active local tests

| Surface | Command or file | Latest result | Boundary |
| --- | --- | --- | --- |
| Existing repository suite | `npm test` | 60/60 pass on 2026-10-09 | 57 pre-existing tests plus 3 new local guard/holdout tests; no production calls |
| Focused ambiguity and prior-state suite | `node --test test/control-ambiguity-gate.test.js test/control-ambiguity-holdout.test.js test/prior-state-gate.test.js` | 19/19 pass | Proves pre-routing stop, no dispatch/queue/history, explicit binding, and no over-blocking |
| Frozen model routing benchmark | `node qwen_mary_kate_benchmark.mjs` | raw Qwen3 4B: 4/6 on 2026-10-09 | Six unchanged cases; resolver output only, no execution; the same affirmative-continuation and approval-boundary weaknesses remain |
| Deterministic post-resolver validator | `node qwen_post_resolver_validator.mjs` | 6/6; 0 regressions; 0 unsafe abstention weakenings | Test-only continuation and approval-state repair |
| Adversarial post-resolver validator | `node qwen_post_resolver_validator_adversarial.mjs` | 15/15; 0 unauthorized continuations; 0 weakened approval boundaries; 0 invented approvals; 0 false certainty | Test-only stale, assent, switch, approval, destructive, paid, credential, and ambiguity cases |
| Context compiler V2.1 | `node mary_kate_context_compiler_v21_fixture.mjs` | 16/16; 0 stale-referent failures; 0 ambiguity-to-certainty failures | Test-only authority/provenance compiler |
| Real-work authority behavior | `node mary_kate_real_work_behavior_fixture.mjs` | 14/14; 0 unsafe authority actions; 0 invented approvals; 0 stale/contradictory certainty | Human-labeled behavior fixture; natural-language parsing remains untested here |

## Frozen artifacts

- Fresh Qwen result: `/private/tmp/mary-kate-v1-repair-qwen4b-frozen-2026-10-08.json`.
- Fresh validator artifacts: `/private/tmp/mary-kate-v1-repair-qwen4b-post-validator-2026-10-08.json`, `/private/tmp/mary-kate-v1-repair-qwen4b-adversarial-2026-10-08.json`.
- Fresh authority artifacts: `/private/tmp/mary-kate-v1-repair-context-v21-2026-10-08.json`, `/private/tmp/mary-kate-v1-repair-real-work-behavior-2026-10-08.json`.
- The new holdout expectations are frozen in `test/control-ambiguity-holdout.test.js` before the test loop executes them.

## Prior comparison evidence

- Deterministic control baseline: safely abstained on the two ambiguous cases, but did not resolve conversational continuation, approval, or workstream-switching intent.
- Local Semantic Router + BGE-small: historical 4/6 with two unsafe false routes. Its Python runtime dependencies are not installed on this Mac, so it was not silently rerun or changed.
- Qwen3 4B Instruct Q4: fresh raw 4/6; the deterministic post-resolver layer raises the frozen six-case result to 6/6 without weakening required abstentions.
- Qwen3.5 candidate retrieval remains historical and allowlist-bounded: catalog holdout coverage 11/12 with one unsafe omission and one false-certainty row; stable-reference holdout candidate recall 1/14 with no fabricated references but broad omissions. It is not an authority or execution decision layer.

## Open acceptance gates

1. The local pre-routing ambiguity repair is verified; deployment and live behavior are not.
2. The local hybrid is viable only as deterministic controls → allowlisted candidate retrieval → bounded resolver → deterministic authority/approval/write gates. Qwen alone is not acceptable.
3. The real Cloudflare V1 acceptance slice remains unproven: scoped Project Truth retrieval, routing, required approval, conditional canonical write, exact reread, and verified D1 receipt must all be observed together.
# 2026-10-09 explicit-subject/read-only development receipt

- Implementation: `97e38b5848aa63bf7cc3825916a1af26d5d8c0a2` on `mary-kate/explicit-readonly-resolution`, based on main `5df0a6d3d0b614f814e95a6dee740272e4c9cb74`.
- Current authority input: research-vault main snapshot `899ea1d222d47dd612fd4efb9dd7a3cce8af7af5`. PROJECT_INDEX routes completion questions to the existing completion/reuse-gap matrix. Neither a verdict nor dated authority filename is hardcoded.
- Before: first six independent regression groups FAIL; the exact MK question has no binding, the Mary Kate paraphrase hits two project projections, and a state candidate for the exact phrase reproduces the empty-evidence downstream ambiguity signature. Exact production candidate/dispatch trace remains unverified.
- After on physical Apple M4 Pro: **68/68 full**, **27/27 focused**, Worker packaging dry-run PASS. Frozen positives and adversarial negatives live in `test/control-readonly-holdout.test.js`. Real current-authority replay PASS through the actual Workers AI adapter with a provider double: scoped current/current-assessment evidence, indexed matrix with provenance, no approval/canonical write. Rejected hostile assessment routes also produce no history row. Successful retrieval answers may create normal private interaction history.
- Prior genuinely ambiguous `What's next?` production PASS is preserved; its local regression includes both apostrophe styles. No production canary was submitted and no production configuration changed.
- Pending: separately authorized normal main → Cloudflare promotion; verify deployed lineage, then exactly one authenticated explicit-MK read-only canary with telemetry and evidence-qualified answer. Full route → approval → conditional write → reread → D1 receipt acceptance remains unproven.
- Detailed durable failure/lesson reconciliation is on research-vault development branch `mary-kate/explicit-readonly-receipt`; canonical main promotion is pending. Existing frozen model/compiler benchmarks remain unchanged.

## Expanded acceptance continuation — 2026-10-09

Latest local verification supersedes the earlier 68/27 totals: **69/69 full**, **28/28 focused**, Worker packaging dry-run PASS. The additional frozen, requirements-based 23-case holdout initially measured six unnecessary clarifications and two unsafe routing acceptances (zero writes). The unchanged holdout now measures **zero** of each. It covers the exact reported input, `Is Mary Kate ready?`, `What’s left for MK?`, polite/unseen readiness and remaining-proof questions, switches, bound continuation, stale/missing/conflicting evidence, unbound-next and consequential/mixed-action ambiguity.

Commit `2ada581e6f374ccf4dfa59faa37b817bde804375` extends assessment recognition and makes distinct explicit projects ambiguous before heading-score competition. All Mary Kate assessments retrieve the indexed completion authority. The foundational read-only proposal/decision rejection remains deterministic. A replay using the actual remote main authority blobs and the real Workers AI adapter with a provider double retrieves the existing matrix for all three requested questions; unbound `What’s next?` stops before routing. Ordinary successful history rows are allowed; approvals/queues/canonical writes are zero. Live model answer quality remains unverified.

Exact baseline error reproduction, before/after per-case results, authority blob SHAs, commands and raw full/focused/build outputs: [test receipt](test-receipts/2026-10-09-explicit-mk-readonly.json). Deployment config, bindings, migrations and Worker entry points have no diff from main. Ready for the separately authorized existing GitHub → Cloudflare promotion and single authenticated explicit-MK retest; no production success is claimed.
