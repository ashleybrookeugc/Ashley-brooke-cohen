# Private video testing — implementation and activation

Status: deployed Mary Kate session integration; existing authorized sessions connect, analyze, review, correct and retrieve after reload without a testing token. Actual non-private live technical flow PASS; physical iPhone/creator/semantic acceptance remains unpassed. Physical iPhone and creator/semantic acceptance remain untested.

## Current review presentation — founder correction

The default review now presents a plain-English overview, chronological notes, speech/caption conflicts, readable timestamp links and source-bound correction labels. Raw programming data stays in a collapsed technical disclosure. This is a deterministic presentation of existing evidence, not a new semantic analyzer. The full saved scope includes workflow/actions/friction, UGC story/hook/pacing/edit advice, B-roll/library, B-Paid and performance lenses; their missing stages remain explicit and unpassed. [Requirement-to-implementation map](REVIEW_REQUIREMENTS.md) routes to the canonical shared V1 plan. Prior live technical PASS does not mean this broader creator outcome is complete.

## Current authentication — 2026-10-15 founder correction

Video Testing reuses Mary Kate's existing signed `abc_admin` login. A user already signed in can select a file and press Analyze with no extra token. A signed-out user follows `/admin/login?returnTo=/video-test/`; successful normal login returns only to that allowlisted path, otherwise to the existing `/control/` default. The shared validator is used by control/moderation and the video gateway, retaining the existing eight-hour expiry and Secure/HttpOnly/SameSite=Strict cookie. Logout or expiry locks video APIs too. No video cookie is minted, and old `__Host-video_test` cookies no longer authorize anything.

The worker bearer remains server-only. The same fixed private VPC service still reaches only the Mac's loopback port; browser cookies are never forwarded. Exact same-origin POST checks, upload cap, endpoint allowlist, redirect refusal and failure without public fallback remain enforced. `VIDEO_TEST_ACCESS_TOKEN` is now obsolete and ignored; its existing secret is retained unused for rollback, without changing any production credentials. `ADMIN_SESSION_SECRET` is the existing Mary Kate secret, not a new video credential. No schema/configuration change is required.

Local validation: website 148/148 with zero skips, 14-requirement gate and Worker packaging pass, including the real Wrangler login → signed cookie → video session → logout, rejected passwords, expired/forged/legacy-cookie rejection, allowed return path, and UI Analyze enablement without token entry. PR #40 merged through the normal GitHub → Workers Builds path (`141d95e`), with CI/Builds SUCCESS and deployed HTML/JS exact. Existing signed-in Brave session automatically connects; no login/token entry; clip selection enables Analyze and job `67281538-0100-4b3b-a5b6-0d45a8e213d9` completes with verified hash/decode/readback and displayed frames at 0/5s. Anonymous/forged/valid-retired-cookie requests remain 401; cross-origin writes 403; retired token exchange 405. Private target, ingress and secret names were reread preserved. Final review verification also PASSED in the existing authenticated Codex test-browser tab: both 720px frame images loaded; five-second seek set currentTime to 5 with readyState 4; speech-000001 correction at 0.03s (ID `54de58b8-a0cf-4660-92ee-ebf3ee6c6c68`) was saved, read back from the worker and retrieved after page reload. That tab also recognized its existing valid Mary Kate session without login/token entry. Initial native tab interruptions are resolved as a verification blocker; no credential handoff or special test auth was used. Exact current session receipt: `docs/test-receipts/2026-10-15-video-session-integration.json`.

## Current activation — 2026-10-15

Website main `72cf11fdbdda82a3b0a4dc928e7f925cf5df8d1c` includes PR #35's ASSETS repair and PR #37's fixed private VPC adapter. The existing `tools/video-testing/server.mjs` runs on the authorized Mac at `127.0.0.1:8789`, importing unchanged analyzer `e5dfe3e4d3967615f23eb064896de1303f86ded9`. A private Cloudflare Tunnel with 404-only public ingress and no published hostname/DNS connects only the VPC Service at that host/port. No network-wide binding, paid service, external AI video service, or footage deletion was added. All three server-side video-test secrets are configured separately from administration.

The real deployed browser selected/uploaded a non-private synthetic clip, displayed the 5.185805-second verified extraction with frames at 0/5 seconds, sought to 5 seconds, saved a speech-observation correction at 0.03 seconds, and retrieved that correction/result after page reload and worker restart. Remote-source playback and exact source hash/range retrieval passed. Live anonymous access, cross-origin writes, and administration access with a testing cookie remain denied. Full website suite 145/145; requirements, packaging, GitHub Actions and normal Workers Builds pass. Exact current receipt: `docs/test-receipts/2026-10-15-video-analyzer-mac-activation.json`; canonical status is also in Project Truth's `research/video-understanding/2026-10-15-mac-video-test-activation.json`.

The full unchanged analyzer is still 17/18: ASR reads `this is fair` as `is is there`. This error is preserved and corrected through feedback, not repaired in the analyzer. Visual/OCR coverage is sampled; semantic vision, enforced semantic claim release, physical iPhone and creator acceptance are not passed.

Keep the Mac and the detached analyzer/connector processes online. Autostart and remote evidence archival are not configured. Worker/connector credentials are kept locally in the existing analyzer's gitignored `.video-analysis-runtime/video-testing-secrets.json` with mode 0600; never print or commit them. Originals, evidence and corrections remain local and retained. Cloudflare Workers VPC is currently free in beta; recheck its pricing before any later transition. The historical checkpoints below preserve earlier stops; this current checkpoint supersedes their not-deployed/access-blocked state.

## Historical cloud-only continuation — 2026-10-14

The existing Node adapter ran in the ChatGPT Work cloud runtime against the unchanged shared analyzer checkout (`video-analyzer/f003-source-time-fidelity` at `e5dfe3e4d3967615f23eb064896de1303f86ded9`), with FFmpeg, ffprobe, Tesseract, and a temporary PocketSphinx 5.0.4 environment. A 5,510,872-byte, 60.095011-second public Big Buck Bunny MP4 (SHA-256 `543a4ad9fef4c9e0004ec9482cb7225c2574b0f889291e8270b1c4d61dbc1ab8`) passed gateway upload, exact source-hash match, full decode, readback-verified package, 13 timestamped sampled frames, OCR and ASR extraction, range playback, source-bound correction, worker restart and correction/result reread. A deliberately invalid file entered `failed`. This was an isolated loopback integration run; the temporary filesystem is not durable hosted storage, the public clip does not test Ashley's footage or speech accuracy, and there is no iPhone URL.

The first hosted-path blocker remains deployment/connectivity: this branch is not deployed, no authenticated Cloudflare connection or testing bindings are present in this Work runtime, and no authorized HTTPS ingress to a persistent cloud analyzer/store has been established. The current gateway expects `VIDEO_TEST_WORKER_URL`, not a native FFmpeg runtime inside an ordinary Worker. The Work runtime can execute the Node adapter for testing but does not supply a persistent public service or verified remote original storage. A Cloudflare Container or other persistent compute/storage configuration would require account access and explicit cost/privacy review before provisioning. Do not point production at this transient Work process.

The adapter now verifies the stored evidence package before labeling a child run `completed`. If a previously completed package becomes unreadable, result retrieval changes the job to `failed` and retains the source; the pre-fix contradiction was reproduced and the negative regression passes. Website full suite after reconciling current main: 110/110. Unchanged analyzer suite with PocketSphinx: 17/18, with the frozen `fair` → `there` ASR wording failure. No semantic vision provider, enforced claim release, or canonical UGC creative-gate execution exists in this slice; those gates are **NOT RUN / NOT YET TESTABLE**, never passed by the successful extraction. See the updated test receipt.

## Historical activation continuation — 2026-10-10

Ashley's “Make it usable” authorizes activation after safety checks; no additional paid infrastructure or private AI transfer is authorized. Worker packaging now PASSES using Wrangler 4.54.0 (`deploy --dry-run`, no upload). Real Chromium at 390×844 now PASSES actual upload to the unchanged analyzer, frame rendering, source playback, cookie persistence, real IndexedDB correction/reload, worker-offline review, exact-file relinking, and offline correction synchronization after reconnect. See `scripts/acceptance/video-testing-browser.mjs`; this uses synthetic media and loopback transport only. Physical iPhone and live Cloudflare remain unverified.

Live activation is ACCESS-BLOCKED: Wrangler whoami explicitly reports unauthenticated; this session has no configured Cloudflare credential or direct Mac execution connection. Cloudflare plugin discovery returned no matching integration. Do not merge an unusable token-gated shell, weaken access checks, embed a token, or claim the Mac is online. Resume with authenticated Cloudflare access and the authorized analyzer host connection, configure the three testing bindings, then activate through the normal deployment path. Deployment guard remains until those prerequisites are met.

## Source / reuse

Website base: main `be17a176943261c165d0f160f472aa16ddc3a21b`.
PR #5 `f272b5a151e75991055accad4d6b16a0d8766cf6` was inspected. Its receipt-versus-creative-acceptance distinction and unavailable-lane presentation are retained. Its historical catalog/admin-only UI is not copied into the upload flow.
Existing analyzer: `video-analyzer/f003-source-time-fidelity`, verified head `e5dfe3e4d3967615f23eb064896de1303f86ded9`. `processVideo` and `verifyEvidencePackage` are imported from that existing checkout. No second analyzer, copied core, media database, paid dependency or model service is introduced. OCR cache defaults and all analyzer tests remain untouched.

## What runs

`/video-test/` is a responsive selection/playback/review/correction shell. `/api/video-test/*` is a separate authenticated gateway. It streams the actual file to an operator-configured authorized worker; Cloudflare does not persist footage. A 64 MiB per-test cap and one active run limit keep this first slice bounded. No queued/offline upload is claimed. The original file remains on the phone; interrupted server copies are retained for diagnosis and never automatically deleted.

The Node adapter binds loopback, creates job receipts under the existing analyzer output root, calls the existing analyzer in a child process (so progress polling remains responsive), verifies the package on result retrieval, and serves allowlisted result/frame/source/feedback routes. Source-time lanes and sampled frames come directly from the verified package. It has no generic file/URL/proxy/tool execution endpoint. Restart turns interrupted work into failed, preserving evidence and raw source. Feedback is append-only, idempotent, source-hash/run/observation/time-bound, and read back before acknowledgement. It never rewrites analyzer evidence or claims model training.

Completed evidence and corrections also cache in browser IndexedDB. With the worker offline, cached evidence remains inspectable, corrections save locally for later synchronization, and reselected footage must exactly match the cached source SHA before playback. Frame bytes are not cached; they are explicitly offline. Clearing browser data can erase unsynced feedback; worker-saved feedback remains retrievable after restart. The page itself still requires an internet connection to load; no PWA/browser-offline installation is claimed.

## Current access and private transport

Use the existing Mary Kate authentication for all video APIs. Keep these server-only bindings configured through the existing deployment secret mechanism:

- `VIDEO_TEST_WORKER_TOKEN`: random server-to-worker credential shared with the authorized local worker; never sent to the browser.
- `VIDEO_TEST_WORKER_URL`: fixed server-configured origin identity, with no caller-controlled destination or redirects.
- `VIDEO_TEST_PRIVATE_SERVICE`: existing private VPC service bound to `127.0.0.1:8789` through the encrypted connector. No public hostname or DNS route.

The previously configured `VIDEO_TEST_ACCESS_TOKEN` is ignored. Do not direct Ashley to token entry, copy a login cookie, or introduce another sign-in. Do not broaden connectivity or publish the worker. The historical activation checkpoints describe earlier state and do not override current authentication.

## Start the adapter on the authorized machine

Use Node 22+ plus the existing FFmpeg, ffprobe, Tesseract and optional existing ASR runtime. Supply `VIDEO_TEST_WORKER_TOKEN` via the machine's secret mechanism (do not put it in shell history or Git).

```sh
VIDEO_ANALYZER_MODULE=/absolute/path/to/existing/analyzer-checkout/tools/video-analyzer/core.mjs \
VIDEO_TEST_ROOT=/absolute/path/to/existing/analyzer-output/testing \
node tools/video-testing/server.mjs
```

Default bind: `127.0.0.1:8789`. The `VIDEO_ANALYZER_MODULE` path must be verified on the actual machine. Missing analyzer/media tools return unavailable before upload. Missing ASR remains an explicit evidence-lane state. The existing analyzer has no semantic vision/creative provider; the UI explicitly says so.

## Verification

`node --test test/*.test.js tests/control-plane.test.js` runs existing control tests plus session/gateway/adapter/frontend regressions. The real adapter integration test requires the existing analyzer path in `VIDEO_ANALYZER_MODULE` (or its original local path); without it that one test explicitly skips, never fabricates extraction. Test fixtures are synthetic only. The UI execution test uses DOM/IndexedDB doubles and is NOT a browser-rendering or real IndexedDB acceptance receipt.

Cloud receipt: `docs/test-receipts/2026-10-10-video-testing.json`.

## Historical deployment hold and acceptance — superseded by authorized activation and session integration

This branch adds a Wrangler custom-build stop (`scripts/video-testing-build-guard.mjs`) for CI/Workers Builds unless `VIDEO_TEST_DEPLOY_APPROVED=1` is explicitly set after separate approval. This prevents an authorized branch push from silently becoming an unauthorized preview upload. Do not remove/enable it without approval. It intentionally blocks the CI Worker packaging step too; local dry-run is allowed. No main merge, preview or production deploy is authorized.

1. Run actual browser acceptance (mobile viewport and iPhone Photos/Files selection, playback codec support, token cookie, correction reload, disconnect/reconnect). This cloud runtime has Playwright but no browser executable; rendered acceptance is unverified.
2. Run Worker packaging dry-run in the existing Wrangler environment. Wrangler is absent here and registry network access is unavailable; packaging is unverified.
3. On the authorized Mac, point to the unchanged analyzer checkout and run its frozen suite with existing ASR runtime. Cloud preserved F-003–F-006/P-002, but the full cloud replay has ASR-dependent failures; it is not a full regression PASS.
4. Establish/reuse the existing authorized HTTPS worker transport, set the three testing bindings and start the adapter. If no existing transport exists, report this one infrastructure gap before creating anything.
5. Obtain separate approval for normal existing GitHub→Cloudflare promotion; then enable the build guard deliberately, merge/deploy by the established path, and verify `/video-test/` on a phone without the admin password.
6. With Ashley's authorized real clip, verify upload → existing analyzer → exact source/time review → correction → restart/retrieval. Repeat with worker unavailable and a failed file. Creator acceptance and semantic accuracy remain separate from technical tests.

No deletion is implemented or authorized. Raw footage is never committed to GitHub or transferred to an external AI provider.
