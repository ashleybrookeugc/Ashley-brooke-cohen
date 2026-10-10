# Workers AI automatic-preservation routing contract receipt

**Date:** 2026-10-10  
**Scope:** isolated in-memory Project Truth fixture; no production, Cloudflare, credential, or real GitHub operation  
**Frozen contract:** `scripts/acceptance/automatic-preservation-handoff-cases.json` at `23665ea` (unchanged)  
**Result:** deterministic contract **PASS**; fresh-worker handoff **PASS**; live provider **NOT RUN / UNVERIFIED**; production acceptance **NOT RUN / UNVERIFIED**

## Contract boundary

The test uses `createWorkersAiRoutingAdapter` with a recorded `submit_control_route` response. That response is valid against the real tool schema and contains only route kind, responsibility, summary/confidence, and a constrained state-update proposal. The schema has `additionalProperties: false` and does not contain `index_route` or `expected_current_value`.

`createControlService` retrieves the Project Truth packet and binds the route/current value itself. It derives the unique `PROJECT_INDEX.md` route, matches the allowed `ACTIVE_WORK.md` field, carries the retrieved authority SHA, and removes model-supplied authority-binding fields. Existing enforcement then supplies authorization, conditional write, canonical reread, receipt, and fresh-worker handoff verification.

## Frozen primary case

Input decision, without a save command: `The video analyzer should prioritize accurate source timestamps over processing speed.`

- Meaningful `state_update` candidate: accepted by the actual adapter.
- Authoritative destination/current-value/index: retrieved and bound by service from the fixture, not model output.
- Existing `ai_can_handle` policy and conditional writer: used unchanged.
- Write/reread/index receipt: verified once in the disposable store.
- Fresh worker: reads the updated state and passes `verifyWorkerHandoff` without replaying the original turn.

## Negative controls

- Missing index route → `canonical_index_route_missing`, zero writes.
- Model-supplied stale expected value plus changed source → `canonical_review_stale`, zero writes.
- Contradictory canonical facts → `canonical_conflict`, zero writes.
- Valid-looking unsupported proposal value → `canonical_evidence_missing`, zero writes.
- Incorrect destination, model-invented approval, or invalid field → real adapter rejects `routing_contract_invalid`, zero writes.
- Already canonical decision → verified no-op, zero writes.
- Temporary conversation → `not_material`, zero writes.
- Dropped handoff instruction and failed GitHub write remain covered by the unchanged frozen 8-case fixture and fail without a saved claim.

## Commands and results

```text
node --test test/control-workers-ai-automatic-preservation.test.js test/control-automatic-preservation.test.js test/control-workers-ai-routing.test.js
26/26 pass

npm test
115/115 pass

npm run check:worker
BLOCKED: local Wrangler executable unavailable
```

No live provider probe was attempted: an authorized Workers AI runtime/credential was not available. No package was installed to bypass that boundary. This receipt is repeatable wiring evidence, not proof of live model understanding, deployed Worker behavior, or production acceptance.
