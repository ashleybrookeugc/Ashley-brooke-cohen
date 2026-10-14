# Mary Kate V1 — open-source automatic-enforcement evaluation

**Verdict:** keep the existing Node enforcement. Promptfoo and OPA both ran in isolated cloud tests, but neither demonstrated an independent material improvement. No production code, dependency, deployment, credential, binding, or unrelated project was changed.

The experiment branch is based on the existing unmerged conversation-regression head `9e8ec44`, because that is where frozen A–E and the actual runner live. Canonical product main advanced concurrently to `2ec645d`; its final full suite passed 121/121. Project Truth main advanced to `3163bdc`; UGC Creator App remained at `db8324d`.

## 1. Baseline

The smallest relevant existing suite passed **37/37** before the experiments. It exercised exact multi-turn context delivery, advice-versus-action handling, approval/version boundaries, unauthorized target changes, completion evidence, sanitized failures, and receipt retention. This was the real current harness on the existing conversation-regression branch, not a weakened substitute.

## 2. Promptfoo

Promptfoo 0.124.1 called the actual `executeConversationCase` implementation with frozen A–E. Expected answers remained outside provider input. A–E correctly reported **BLOCKED** because no authorized non-production Workers AI binding existed; there were no model tokens or paid calls. The foreign-tool negative control passed and executed no effect.

Result: **1 pass / 5 blocked-as-fail / 0 errors**. Promptfoo detected no issue the existing runner did not already expose. It added a 1.4 GB isolated install and about 22 seconds of command startup around a 91 ms internal evaluation. Its UI/reporting could be convenient, but that is not a material enforcement or regression-detection improvement here. **Do not adopt.**

## 3. OPA

The existing Node policy adapter and OPA received the same eight required structured cases plus one malformed-input control. Both were correct on **9/9**, agreed on **9/9**, produced no false pass or false block, and executed **zero prohibited effects**. The two legitimate cases and the unrelated-task case were allowed.

OPA WASM loaded in 2.35 ms and evaluated all nine inputs in 0.88 ms; the Node decisions totaled 1.31 ms. The difference is immaterial at this scale. Wrangler dry-run packaged the Worker at 272.61 KiB / 88.24 KiB gzip, within ordinary Workers Free packaging constraints. A local Worker runtime smoke could not start on this cloud host because Wrangler hit `uv_interface_addresses` error 1, so actual Cloudflare execution is **unverified**.

Two integration failures were preserved: Rego `sprintf("%q")` failed in the JavaScript WASM SDK, and the browser SDK's default export was initially imported as a named export. Both were corrected before the 9/9 pass. These are concrete portability and maintenance costs. OPA found no new policy defect and duplicates the existing Node gate. **Do not adopt for this boundary.**

## 4. Comparison

| Option | Required cases | False pass/block | Prohibited effects | Traceability | Added burden | Cloudflare Free / paid API |
| --- | ---: | ---: | ---: | --- | --- | --- |
| Existing Node | 9/9 | 0/0 | 0 | Existing receipts and tests | Lowest | Native; no paid API |
| Node + Promptfoo | Same Node detection; A–E live BLOCKED | 0 observed | 0 | Adds another report format | 1.4 GB isolated install; another config/provider | No paid API required, but no live result without inference |
| Node + OPA | 9/9; no new detection | 0/0 | 0 | Rego/WASM decision receipt | Compiler, SDK, policy duplication, build step, portability fixes | Dry-run compatible; actual Worker runtime unverified |
| Combined | No independent combined value shown | — | — | More formats, not more evidence | Highest | Not justified |

## 5. History preservation

The test record retains the initial WASM failure, a broader incompatibility hypothesis later disproven, the narrow correction, the passing regression, and the separate unresolved Cloudflare-runtime limitation. Three preservation tests prove the chain remains linked, the original failure survives later success, result/hypothesis/conclusion types remain distinct, and a fresh session can retrieve the chain by task language without a filename. No footage, secret, or private diagnostic payload is stored.

## 6. Implemented

No production integration was justified. The branch adds only an isolated experiment, deterministic comparisons, build-history fixtures/tests, this report, and a machine-readable receipt. Existing Node enforcement remains authoritative.

Published branches: product `test/mk-promptfoo-opa-20261014` at `c448a609d68624513c869e8566862b580ba0f438`; Project Truth branch of the same name at `57e107eef7610cf9c241189499552b0e389bf0c6`. Neither was merged or deployed.

## 7. Regression results

- Original relevant suite after the experiment: **37/37 pass**.
- Full development-branch suite: **143/143 pass**.
- Final current-main suite at `2ec645d`: **121/121 pass**; relevant subset **21/21**; decoded-frame regression **3/3**.
- Deliberately malformed policy input: Node, OPA CLI, and OPA WASM all fail closed.
- Unrelated writes: **0**. Deployments: **0**.

## 8. V1 status

Verified now: deterministic rejection of missing frame evidence, unauthorized/wrong-target writes, unexecuted gates, missing failure receipts, and malformed inputs; legitimate and unrelated tasks are not over-blocked; denial is coupled to the effect wrapper; failure-and-repair history is retained and retrievable.

Still open: live A–D conversational inference, successful rerun of known-live-failing E, contextual-approval C before dispatch, actual Cloudflare runtime execution of the OPA build, and end-to-end automatic enforcement on the live integrated conversation path. Automatic enforcement is **not complete**.

## 9. Smallest next action

Run unchanged live case E once through the already prepared authenticated non-production Workers AI surface and independently score the returned receipt. Do not add Promptfoo or OPA first.

Machine-readable evidence: [`docs/test-receipts/2026-10-14-open-source-enforcement-evaluation.json`](test-receipts/2026-10-14-open-source-enforcement-evaluation.json).
