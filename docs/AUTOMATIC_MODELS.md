# Automatic model selection — development foundation

Founder requirement: Mary Kate chooses a suitable model/effort automatically, carries relevant context and uses free options where possible, without asking Ashley to choose a model for each task. This was reconfirmed 2026-10-14; it is not a new undecided architecture question.
Canonical founder authority: ashleybrookeugc/research-vault/research/ai-workflows/2026-10-04-mary-kate-founder-intent-decomposition.md.

## Implemented boundary

Existing authenticated chat and Command Center show automatic selection policy, configured connections, task acceptance and selected model per answer. GET /api/control/models makes no inference. No key/model/permission can be set through a chat request or this read-only endpoint. Backend integrates with the existing service, GitHub retrieval, approval and write guards. Native role history and the current task packet remain inputs; no browser-supplied permission authority.

Opt-in CONTROL_AUTO_MODELS=true selects the new policy. Default absent/false preserves the existing router and production configuration. Private notes and unresolved conjunctive clarification take zero AI calls. Other requests classify using bounded application rules, not another model call: conversation, reasoning, coding or action. Short followups use the immediately preceding user request; the saved project registry does not pick the task. This initial heuristic is not proven general semantic routing. Selection chooses the cheapest estimated compatible accepted free-tier candidate; it is not a claim to know the globally best model.

A candidate needs server-maintained CONTROL_MODEL_ACCEPTANCE entries such as llama:conversation or coder:coding backed by actual task acceptance evidence. Default empty. Llama/Qwen conversation failures remain FAIL; no entries have been enabled, no production model default changed, and no model is promoted by these mocked transport tests. The fixed historic conversation test surface still tests its original provider/model, separate from the new automatic selector. Original fixture contracts remain unchanged.

## Free-only activation prerequisites

Verify the existing Cloudflare account is on Workers Free before setting CONTROL_WORKERS_FREE_PLAN_CONFIRMED=true. A binding alone does not establish a free plan. No paid-only Workers models appear in this catalog. Cloudflare documents a shared 10,000-neuron daily free allowance resetting 00:00 UTC; account availability/other workload consumption is not readable by this module. Provider exhaustion blocks with no retry or provider upgrade.

Set CONTROL_MODEL_DAILY_CALL_LIMIT (default25, range1–1000), CONTROL_MODEL_DAILY_NEURONS (default8000, maximum10000). The existing D1 database stores atomic UTC-day calls/neuron/USD reservations; concurrent requests cannot race past configured local limits. Per-model neuron prices were checked 2026-10-14. Conservative byte-based input bounds include2048 framing allowance; total context capped24000bytes, outputs700tokens for conversation/action or1400 for reasoning/coding. These are local reservation ceilings, not actual billing or an account-wide remaining-quota reading. No automatic retry, model-based evaluator, summarizer or paid escalation. Failed/timed-out dispatch reservations are not refunded.

## OpenAI connection — prepared, disabled and live untested

Uses official HTTP Responses endpoint with exact native role history, instructions, automatic low/high effort, bounded max_output_tokens (includes reasoning), store:false and no tools. Only read-only tasks eligible. Existing state-changing action classifier retains the reviewed function contract; no new OpenAI action execution capability was introduced.

Before allowing OpenAI calls, configure server-secret CONTROL_OPENAI_API_KEY and explicit CONTROL_OPENAI_MODEL, accepted task entries, CONTROL_ALLOW_PAID_MODELS=true, CONTROL_MODEL_DAILY_MICRO_USD (default0), current positive CONTROL_OPENAI_INPUT_USD_PER_MILLION and CONTROL_OPENAI_OUTPUT_USD_PER_MILLION, CONTROL_OPENAI_PRICE_VERIFIED_AT (must be no more than24h old). CONTROL_SPENDING_POLICY must identify the approved spending policy. Use a provider project cap as well. The local USD gate uses conservative reservations with configured current rates; it is not an invoice guarantee and cannot control calls made outside Mary Kate. No price, paid consent, key or funding was assumed. No credential was created/read and no live OpenAI request ran. Sign in with ChatGPT eligibility for this remotely hosted app is unverified; this adapter uses normal API access, not a personal dots session.

## Evidence and limits

Tests prove task policy, zero-call paths, eligibility/payment gates, single-call dispatch, native context, output caps, safe provider failures, no retries/paid fallback, auth on status endpoint, secret exclusion and D1 atomic SQL. A separate actual SQLite test made12 concurrent reservations with a3-call/$0.0003 configured cap: exactly3 allowed,9 rejected. Provider API output is simulated in local transport tests; no model quality PASS follows. Live provider, paid-budget invoice reconciliation, authenticated iPhone usability and autonomous end-to-end execution remain unverified. Production deployment/merge is not authorized by this development implementation.

Reuse preflight: existing policy adapters/native-history/D1/GitHub controls reused; existing founder decomposition/framework bakeoff consulted. Official Responses HTTP reused rather than building model inference. LibreChat and Open WebUI are documented ready workspace alternatives, not evaluated replacements for these existing canonical guards; installing a whole additional workspace would not itself supply account access or repair conversation acceptance. No new framework/resource/provider signup introduced. Wrangler was restored as the repository's existing build dependency, not a new AI framework.

Sources checked2026-10-14:
- https://developers.openai.com/api/docs/quickstart
- https://developers.openai.com/api/docs/guides/text
- https://developers.openai.com/api/docs/guides/reasoning
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://www.librechat.ai/docs/features/agents
- https://docs.openwebui.com/alternatives/chatgpt/
