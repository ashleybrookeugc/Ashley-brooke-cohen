# Private control plane implementation

`/control/` is a thin authenticated doorway over canonical GitHub state. GitHub remains the durable source; D1 stores private interaction history, pending decisions, routing output, and technical receipts.

## Runtime configuration

Non-secret variables: `CONTROL_GITHUB_APP_ID`, `CONTROL_GITHUB_INSTALLATION_ID`, `CONTROL_MODEL_ENDPOINT`, and optional `CONTROL_MODEL_NAME`.

Runtime secrets: `CONTROL_GITHUB_APP_PRIVATE_KEY` and `CONTROL_MODEL_API_KEY`.

Install the GitHub App on `research-vault`, `ugc-creator-app`, `B-Paid`, and `Ashley-brooke-cohen`. Grant repository Contents read/write so the Worker can mint two down-scoped installation tokens: Contents read across those four repositories and Contents write for `research-vault` only. The adapter independently rejects every write outside `research-vault`.

The provider-neutral routing endpoint accepts the versioned `control-route.v1` envelope and returns the route object or `{"route": ...}`. Route validation fails closed. Apply `migrations/0004_control_plane.sql` to D1 before enabling production traffic.
