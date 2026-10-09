# Mary Kate V1 control-plane test registry

This is the product-local registry for the bounded routing and execution-acceptance work. It records test surfaces and evidence pointers; it does not authorize deployment, approval, canonical writes, publication, spending, transfer, or deletion.

## Canonical implementation state

- Repository: `mary-kate-v1`, local `main` and `origin/main` both at `ee38ac9606605c17e696e5cb3a704a00d5b4401c` (`Block unqualified workstream requests before routing`).
- Remote comparison: local `main` is clean and matches the fetched GitHub `main`; the ambiguity repair was already published by the preceding Codex session.
- Published repair: `src/control/service.js`, `test/control-ambiguity-holdout.test.js`, this registry, and the product failure record are included in `ee38ac9` and its parents.
- Product failure history: `docs/TROUBLESHOOTING_LOG.md`.
- Production boundary: `docs/CONTROL_PLANE.md` records the earlier GitHub read/route evidence and explicitly leaves the canonical write → reread → D1 receipt slice unproven.

## 2026-10-09 reconciliation and production boundary

- GitHub Actions control-plane regression run for `ee38ac9` completed successfully: [run #46](https://github.com/ashleybrookeugc/Ashley-brooke-cohen/actions/runs/37880842397). This verifies the repository test workflow, not Cloudflare traffic.
- An existing authenticated control-plane observation for exactly `What's next?` in a multiple-eligible-workstream context returned the ambiguity response `prior_state_ambiguous_scope`; the visible page showed no waiting approval item and no new matching recent-outcome row. No second request was submitted.
- The observation is **PARTIAL / UNVERIFIED for production acceptance**. The served Worker lineage, exact zero model/router dispatches, before/after queue/history delta, and canonical-write absence could not be obtained because the Cloudflare CLI required an unavailable API token and the dashboard session was unauthenticated. Do not promote this observation to a production PASS.
- Accessible 2026-10-08 Codex session records were reconciled into the checked-in artifacts and canonical Project Truth registry. Durable prompts/decisions, test inputs/results, failures, and commit provenance are preserved; unavailable hidden reasoning and full private transcripts are not claimed or copied.

## Active local tests

| Surface | Command or file | Latest result | Boundary |
| --- | --- | --- | --- |
| Existing repository suite | `npm test` | 60/60 pass on 2026-10-08 | 57 pre-existing tests plus 3 new local guard/holdout tests; no production calls |
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
