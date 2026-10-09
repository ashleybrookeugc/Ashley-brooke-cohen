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

### 2026-10-09 disabled-by-default Herdr worker adapter

- Development branch base: `b0d12c68c2e29ceff59338760a4121061adf8e2d` (`mary-kate/hermes-herdr-monitoring`). No production code, configuration, merge, or deployment changed.
- Adapter regressions: 8/8 PASS. The full repository suite is 82/82 PASS. Worker dry-run packaging passes after repository dependencies are installed; the local Node adapter is not imported into the Cloudflare Worker bundle.
- Real M4 Pro acceptance: PASS. A dedicated Herdr v0.9.3 headless session launched one disposable Codex 0.162.0-alpha.2 worker in an isolated `/private/tmp` cwd with fixed read-only/offline/no-integration controls. Stable identity was `session=mk-adapter-etzs9p`, `workspace=w1`, `pane=w1:p1`, `agent=mk-v1-test`. Herdr directly observed `idle (seq 1) → working/running (seq 2) → idle/completed (completion seq 3)`. Closing the adapter-owned workspace produced `disconnected`; it did not remain falsely running.
- Trusted global Codex configuration SHA-256 matched before activation and after the live run: `9fb3f9cf4fad2aa6be25963663a8a0d2616f205e64050fff5569413758581e15`. The adapter never wrote configuration. Pre-existing managed Codex process IDs 67375 and 67639 were present before and after the run. The test-owned Herdr server stopped.
- Negative boundaries: the adapter stays inactive by default; missing/mismatched baselines stop before Herdr; broader capabilities are rejected; unknown/blocked/disconnected remain distinct; completion never self-certifies task outcome. The first live attempt stopped before launch because the isolated Herdr server was absent; the harness now starts/stops that dedicated server. A later harness parse defect also stopped before launch and is covered by `npm run check:herdr-acceptance`.
- Exact sanitized evidence: `docs/test-receipts/2026-10-09-herdr-worker-adapter.json`. Full local runtime receipt remains outside Git at `/private/tmp/mk-herdr-adapter-live-tXzs9p/receipt.json`.
- Still unverified at the adapter checkpoint: production activation, Mary Kate live-interface display, durable worker registry/reconnect across service restart, task-result validation/writeback, and any permission mode broader than the frozen read-only acceptance envelope.

### 2026-10-09 real Herdr worker in the existing local control interface

- Development source for the local bridge and existing-page projection was first preserved at `1436a9bc21c9d878f476ff870293ccf743ed186c` on `mary-kate/herdr-worker-adapter`. It adds no production route, launch control, permission, or deployment.
- The bridge is loopback-only and read-only. It is disabled by default, returns an inactive response without touching the adapter, rejects mutation requests with HTTP 405, and sanitizes telemetry errors. The existing page visibly separates worker execution completion from independent result verification and displays model/tokens/cost only when supplied; this runtime supplied none, so all three showed `Unavailable`.
- Automated verification: 14/14 focused adapter/interface tests, 21/21 including the control-page UI tests, and 89/89 full repository tests PASS; both acceptance runners parse. The same control page's embedded script parse guard remains active. Worker dry-run packaging PASS for the source bytes later preserved in `1436a9b`; no deploy occurred.
- Real M4 visual acceptance: PASS. One authorized disposable Codex worker appeared in the actual loopback-served `/control/` page with stable identity `herdr:mk-ui-n635tj:w1:mk-ui-test` and task `Read-only local worker display acceptance`. Browser observations showed Idle, Running, and `Execution completed` while explicitly stating the result was not independently verified. The endpoint then delivered Disconnected; after shutdown the page showed telemetry unavailable, not active.
- Endpoint snapshots and adapter evidence align on `idle → running → completed → disconnected`. Global Codex config remained at trusted SHA-256 `9fb3f9cf4fad2aa6be25963663a8a0d2616f205e64050fff5569413758581e15`. Every pre-existing observed Codex PID survived; the bridge never enumerated, adopted, messaged, restarted, closed, or signaled an external session.
- Mobile acceptance: at a 390×844 browser viewport, `innerWidth`, document `clientWidth`, and document `scrollWidth` were all 390 px; the page remained one-column and usable without horizontal overflow.
- Exact sanitized evidence: `docs/test-receipts/2026-10-09-herdr-worker-interface.json`. Full local runtime receipt remains outside Git at `/private/tmp/mk-hui-N635tj/receipt.json`.
- Still unverified: restart/reconnect persistence, heartbeat expiry, actual model/token/cost telemetry, task-result validation/writeback, production activation, and any broader permission envelope.

### 2026-10-09 Cloudflare worker-telemetry implementation (pre-production)

- The existing Worker activity section now has a bounded Cloudflare data path. The M4 publisher remains disabled by default, sends only an allowlisted snapshot over outbound HTTPS, and signs the exact body plus a short-lived timestamp. The production inventory route remains behind the existing admin session. No Herdr/M4 service or launch action is exposed publicly.
- D1 retains one latest sanitized `m4-herdr` snapshot. A 20-second expiry deterministically changes cached workers from any prior state to `disconnected`; unknown telemetry is never promoted to active. Model, token, and cost remain unavailable unless the runtime supplies them. Execution completion remains explicitly unverified.
- New regressions cover exact-body signatures, tamper/stale rejection, credential-field exclusion, forced-unverified outcomes, fresh-to-disconnected projection, disabled-by-default publishing, fixed HTTPS target, and credential-safe failures. The source development branch passed **95/95**; the fresh-main integration candidate deliberately excluded unrelated workflow-adherence development commits and passed its complete **90/90** suite on the physical M4 Pro. Worker dry-run packaging: PASS.
- Not yet proven at this checkpoint: Cloudflare secret binding, main integration/deployment, authenticated production rendering, one real M4 heartbeat through production, or offline display after heartbeat expiry. Those require the bounded deployment acceptance and must not be inferred from tests.

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
