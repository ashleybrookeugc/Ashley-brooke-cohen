# Private control plane implementation

`/control/` is a thin authenticated doorway over canonical GitHub state. GitHub remains the durable source; D1 stores private interaction history, pending decisions, routing output, and technical receipts.

## Runtime configuration

Non-secret variables: `CONTROL_GITHUB_APP_ID`, `CONTROL_GITHUB_INSTALLATION_ID`, `CONTROL_MODEL_ENDPOINT`, and optional `CONTROL_MODEL_NAME`.

Runtime secrets: `CONTROL_GITHUB_APP_PRIVATE_KEY`, `CONTROL_MODEL_API_KEY`, and (when M4 telemetry is enabled) `CONTROL_WORKER_TELEMETRY_SECRET`.

Install the GitHub App on `research-vault`, `ugc-creator-app`, `B-Paid`, and `Ashley-brooke-cohen`. Grant repository Contents read/write so the Worker can mint two down-scoped installation tokens: Contents read across those four repositories and Contents write for `research-vault` only. The adapter independently rejects every write outside `research-vault`.

The provider-neutral routing endpoint accepts the versioned `control-route.v1` envelope and returns the route object or `{"route": ...}`. Route validation fails closed. Apply `migrations/0004_control_plane.sql` to D1 before enabling production traffic.

## Current verification status — 2026-10-02

The authenticated production Project Truth read gate passed on 2026-10-01. The earlier production GitHub App 403 cause remains unresolved; do not infer that observability or any other unproven change caused the successful read.

Main commit `b27570612ac3995844853cf8d643d498e94007ea` was verified in production for workstream-scoped prior-state behavior and plain-English failure reporting. The identical Mary Kate request stopped before routing/writing because the `Mary Kate / AI operating system` projection still contained an obsolete Temporal continuation. Project Truth later reconciled that stale continuation in research-vault commit `5978d9d9adddc5df24d721a6fa6871d339ee1726`: the completed Temporal work remains provenance/history and the current continuation is the V1 production write-slice verification.

Current website main is `5d5251b1c6715c543b68a856b377b49ef1d0b6a0`, containing enforcement `4cf91eecd58cd599f43336130081cf485ec8e9d3` that rejects a proposal section differing from the resolved workstream; the existing suite passed 11/11 locally. Authenticated Cloudflare dashboard evidence on 2026-10-04 shows its “Regress resolved workstream proposal binding” Worker version `0af78c43…` active at 100% traffic and successful builds for both commits. This establishes deployment lineage, not vertical-slice completion.

The preserved exact production request “so make video analysis a priority and tell me what the next steps are to making it” was submitted exactly once on 2026-10-04 after that deployment. It failed closed at `prior_state_ambiguous_scope`: the required `next` fact matched Shared video-understanding / evidence engine, ContentEase / UGC Creator App, and UGC / creator campaign and editing operations. No proposal or approval item was created, no canonical write was attempted, no reread/D1 receipt exists, and the old unsafe Current stage approval remained unapplied. This proves the ambiguity gate safely stops an underspecified video request; it does not prove semantic workstream resolution, the repaired proposal binding on a live request, or the write slice.

The remaining production acceptance boundary is still:

`identical natural-language request → scoped prior-state retrieval → routing → approval when genuinely required → conditional canonical GitHub write → exact GitHub reread → verified D1 receipt`

Do not mark the vertical slice passed until the actual production write, canonical reread, and D1 receipt all verify. A direct GitHub maintenance edit performed outside the production control path is not evidence that this production slice passed.

## Routing-failure diagnostics

Rejected routing attempts are retained in the existing private D1 interaction table (`route_json.diagnostic`) with `outcome_status: failed` and the interaction ID as correlation ID. No approval item, canonical write, or verified receipt is created by this path. The authenticated history response and its separate Routing failure disclosure expose the sanitized route structure, fixed validator path/reason, and provider/model identity. Free-form strings are represented by type/length; unrelated provider fields and configured credential values are excluded.

The state response advertises `routing_diagnostics.version: control-routing-failure.v1` only in this implementation. Verify that backend capability marker in production before submitting the single diagnostic request; repository publication alone does not prove deployment.

## 2026-10-09 reconciliation

The reviewed ambiguity repair is on GitHub `main` at `ee38ac9606605c17e696e5cb3a704a00d5b4401c`, and the repository control-plane workflow completed successfully in [GitHub Actions run #46](https://github.com/ashleybrookeugc/Ashley-brooke-cohen/actions/runs/37880842397). An existing authenticated control-plane observation of `What's next?` with multiple eligible workstreams returned `prior_state_ambiguous_scope`; no second canary request was submitted. The latest canonical Project Truth receipt records the prior unbound `What's next?` production canary as a separate PASS; the full V1 mutation slice remains unproven.

The direct observation in this session did not expose the active Worker version or exact dispatch/mutation telemetry. Separately, the latest canonical failure record confirms that `Do you think v1 of mk is complete?` was unnecessarily blocked as ambiguous; this is a distinct production regression and the next bounded repair gate. The full route → approval → write → reread → D1 receipt slice remains unproven.

## Local coding-worker adapter (development only)

`src/local-workers/herdr-adapter.js` is a local Node adapter for Herdr-owned Codex workers. It is not imported by the Cloudflare Worker and remains disabled unless its caller explicitly supplies `enabled: true` and calls `activate()`.

Activation fails closed unless the current global Codex `config.toml` SHA-256 matches a separately supplied trusted baseline. The adapter never creates, updates, or accepts a baseline itself. A worker launch additionally requires a test-only Project Truth authorization receipt naming its canonical repo, path, and commit. V1 permits only an isolated cwd, read-only filesystem, no worker-tool network, and explicit `none` for GitHub, Cloudflare, spending, publishing, deletion, and private-data permissions. Codex starts with fixed hardening arguments; callers cannot add CLI arguments. The child environment is allowlisted and does not inherit credential variables, MCP servers, apps, or plugins.

The returned worker contract is intentionally small: stable adapter/session/workspace/pane/agent identity, task ID and summary, Herdr-sourced state, last observation time, and progress events. State mapping is `working → running`, `idle without completion_seq → idle`, `idle/done with completion evidence → completed`, recognized prompt/approval UI → `blocked`, missing owned agent → `disconnected`, and all unsupported classifications → `unknown`. `outcome_verified` remains false: a Herdr completion transition proves the turn settled, not that Project Truth accepted the result.

The adapter controls only workspaces it creates in its named Herdr session. It does not discover, import, restart, close, or take ownership of existing Codex sessions. The local service runner is responsible for starting/stopping its dedicated Herdr headless server.

`src/local-workers/control-interface.js` is the loopback-only, read-only bridge into the existing `/control/` page. It binds `127.0.0.1`, exposes only `GET /api/control/workers`, returns HTTP 405 for mutation attempts, and remains disabled unless its caller explicitly supplies `enabled: true`. The page polls actual adapter snapshots and shows worker identity, assigned task, Herdr state, observation/progress evidence, and the separate result-verification boundary. Missing model, token, and cost telemetry renders as `Unavailable`; telemetry failure renders `Unknown`/unavailable rather than active. The local bridge does not duplicate Project Truth state and labels that state endpoint unavailable in its worker-only view.

This development branch adds no worker-launch control to the page and does not activate the adapter in the Cloudflare Worker. Production enablement, durable reconnect, broader permissions, and result-validation/writeback remain outside this local display slice.

## Private M4 worker telemetry bridge

The Cloudflare projection reuses the same Worker activity section and never exposes Herdr or a local M4 port. The M4-side publisher is disabled by default and can only send an allowlisted, read-only worker snapshot to the fixed HTTPS path `/api/control/workers/telemetry`. It signs the exact body plus a short-lived timestamp with `CONTROL_WORKER_TELEMETRY_SECRET`; the Worker rejects invalid, changed, or stale signatures. The worker child never receives that credential.

The Worker stores only the latest sanitized snapshot in the existing D1 binding. Private keys, tokens, authorization headers, arbitrary worker fields, and worker-result claims are excluded; `outcome_verified` remains false. The authenticated browser reads `GET /api/control/workers` through the existing admin session. After 20 seconds without a heartbeat, every retained worker is projected as `disconnected` with unavailable telemetry rather than active. Polling is bounded to five seconds. There is no launch or mutation route.

This is operational telemetry, not a second Project Truth. A connected heartbeat proves only current Herdr observation of an adapter-owned worker. It does not prove the worker result, canonical writeback, production mutation slice, broader permissions, or model/token/cost data that Herdr does not expose.

## Read-only My Work projection (development only)

`/control/my-work/` is the smallest authenticated My Work dashboard slice. Its API rereads `research-vault/ACTIVE_WORK.md` through the existing down-scoped GitHub adapter on every request, then derives current workstream state, blockers/waiting conditions, next actions, and founder-approved deferred work. The UI refreshes automatically every 60 seconds and exposes the GitHub blob SHA so stale-source questions are inspectable.

The projection has no task table, migration, canonical-write route, approval button, or worker-launch control. It does not turn open side ideas into approved tasks. Its Verified completion view accepts only existing D1 history rows with a `verified` canonical-write receipt, verified reread status, and GitHub commit SHA; this proves that the canonical update completed, not that the broader project or worker outcome is complete. Worker-claimed completion and prose containing `PASS` are excluded.

This development slice does not prove Cloudflare deployment, authenticated browser rendering, Mac connectivity, or real-time completeness. Those remain separate acceptance gates.

## Bounded retrieval trace candidate (2026-10-15; not deployed)

Canonical execution audit, graph inventory, live cases and limitations: [research-vault retrieval audit](https://github.com/ashleybrookeugc/research-vault/blob/main/research/ai-workflows/2026-10-15-production-retrieval-audit.md).

`src/control/retrieval.js` classifies ordinary read questions without granting action authority, follows the existing PROJECT_INDEX authority table for founder decisions, tests and failures, and selects whole paragraphs under explicit character budgets. Current-state answers receive raw current checkpoints rather than only the older parsed project projection. One bounded failure-hub expansion is allowed. This is lexical paragraph selection, not a semantic retriever or a freshness/answer-quality guarantee. Sources preserve actual blob SHAs; separate reads are not an atomic repo snapshot. Source documents remain evidence, never permission.

The capture service returns `control-retrieval-trace.v1` on success and failure, emits the same sanitized trace through its observer, and stores successful trace provenance in existing interaction history. The Worker observer emits structured logs. Traces contain correlation ID, Worker version metadata when bound, source paths/blob SHAs, source/cache sizes, chosen workstream, intent, prior-state gate, selected paragraph IDs, missing evidence, dispatch context characters and estimated tokens (characters/4), observed provider/model/usage, outcome and stage timing. They exclude input text, source excerpts, generated answer text and credentials. `routing_dispatch` is a policy-adapter call, not proof of a billed model inference; provider metrics identify actual provider returns. Missing usage remains missing. Worker metadata supplies runtime version ID/tag, not a fabricated commit SHA; join it to authenticated Cloudflare deployment/build metadata for commit lineage.

No proposal is accepted for a read question. Explicit required facts, mutation workstream binding, finite write targets, approval, SHA concurrency checks and GitHub reread gates remain independent. Do not equate local provider doubles, structured traces or packaging with live answer quality. The separately preserved daily-advice repair at e1bb840 remains undeployed on its owning development line; do not merge that entire divergent branch to deploy this candidate.

## Founder conversation and temporal-evidence contract

`conversation-contract.js` compiles read-only evidence with Ashley as founder/user and AI workers as implementation owners; this identity grants no permissions. Current saved status is separate from archival references, and it is not a live runtime check. Ordinary present questions do not receive archived failure bodies; explicit history questions receive labelled historical excerpts. Provider and independent service guards check the tested developer-attribution/homework and unverified present-error forms, returning an inert, low-confidence abstention with content-free reason codes and optional technical details. No additional inference, retry, approval, task or write occurs. Explicit technical explanations and qualified current user reports remain supported. The frozen five-preview corpus and independent positive/negative controls live in `test/control-conversation-contract.test.js`. This is bounded failure prevention, not a general semantic verifier or a V1 completion claim.
