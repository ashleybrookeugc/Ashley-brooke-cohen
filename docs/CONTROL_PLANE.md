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

Current website main is `2de35ceca5701f902718d29c466f5c446cf979cd`. Its source adds a focused fix so the phrase `next bounded action` is not simultaneously interpreted as the shorter `next` field, plus a regression test. Repository source is evidence of implementation state only; this document does not claim CI or live Cloudflare deployment for that commit without separate evidence.

The remaining production acceptance boundary is still:

`identical natural-language request → scoped prior-state retrieval → routing → approval when genuinely required → conditional canonical GitHub write → exact GitHub reread → verified D1 receipt`

Do not mark the vertical slice passed until the actual production write, canonical reread, and D1 receipt all verify. A direct GitHub maintenance edit performed outside the production control path is not evidence that this production slice passed.
