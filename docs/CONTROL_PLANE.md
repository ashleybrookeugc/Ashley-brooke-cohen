# Private control plane implementation

`/control/` is a thin authenticated doorway over canonical GitHub state. GitHub remains the durable source; D1 stores private interaction history, pending decisions, routing output, and technical receipts.

## Runtime configuration

Non-secret variables: `CONTROL_GITHUB_APP_ID`, `CONTROL_GITHUB_INSTALLATION_ID`, `CONTROL_MODEL_ENDPOINT`, and optional `CONTROL_MODEL_NAME`.

Runtime secrets: `CONTROL_GITHUB_APP_PRIVATE_KEY` and `CONTROL_MODEL_API_KEY`.

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

The reviewed ambiguity repair is on GitHub `main` at `ee38ac9606605c17e696e5cb3a704a00d5b4401c`, and the repository control-plane workflow completed successfully in [GitHub Actions run #46](https://github.com/ashleybrookeugc/Ashley-brooke-cohen/actions/runs/37880842397). An existing authenticated control-plane observation of `What's next?` with multiple eligible workstreams returned `prior_state_ambiguous_scope`; no second canary request was submitted.

This is not a production acceptance pass. The active Cloudflare Worker version, exact zero model/router dispatches, before/after queue/history effects, and canonical-write absence remain unverified because the Cloudflare CLI had no API token and the dashboard session was not authenticated. The full route → approval → write → reread → D1 receipt slice remains unproven.
