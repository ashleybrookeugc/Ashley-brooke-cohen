# Private video testing — implementation and activation

Status: local mobile-browser and Worker-packaging checks pass; not deployed or accepted on a real iPhone.

## Activation continuation — 2026-10-10

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

## Access separation

Set independent, cryptographically random secrets of at least 32 characters through the existing deployment secret mechanism:

- `VIDEO_TEST_ACCESS_TOKEN`: testing-only token, entered once in the page. Rotating it revokes all testing sessions.
- `VIDEO_TEST_WORKER_TOKEN`: separate server-to-worker credential; same value in the gateway and authorized worker environment, never sent to the browser.
- `VIDEO_TEST_WORKER_URL`: an existing authorized HTTPS origin that forwards only `/video-worker/*` to the loopback worker. No redirects accepted. No caller-controlled destination.

Trusted-device session: 30-day HMAC signature, `__Host-` cookie, Secure/HttpOnly/SameSite=Strict. POST requires exact same origin. Testing credentials do not authorize `abc_admin` or any production admin API. Shell/assets contain no private footage, credentials, or result data. No D1/schema changes. No new storage service, tunnel, hostname or paid infrastructure has been provisioned. A reachable authorized HTTPS transport has NOT been established in this task; do not invent one or expose the local worker publicly to finish acceptance.

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

## Deployment hold and exact remaining acceptance

This branch adds a Wrangler custom-build stop (`scripts/video-testing-build-guard.mjs`) for CI/Workers Builds unless `VIDEO_TEST_DEPLOY_APPROVED=1` is explicitly set after separate approval. This prevents an authorized branch push from silently becoming an unauthorized preview upload. Do not remove/enable it without approval. It intentionally blocks the CI Worker packaging step too; local dry-run is allowed. No main merge, preview or production deploy is authorized.

1. Mobile-browser check: the checked-in shell rendered at 390×844 with no horizontal overflow or console errors, and its independent testing-token gate, video-only picker and offline-disabled Analyze control were visible. This is not iPhone Safari/Photos/Files, codec, real-cookie or correction-round-trip proof. Receipt: `docs/test-receipts/2026-10-10-video-testing-mobile-packaging.json`.
2. Worker packaging dry-run: PASS with Wrangler 4.63.0 (149.99 KiB / 40.09 KiB gzip). The build guard ran locally and no upload occurred. This is not a Cloudflare preview or production deployment. Receipt: `docs/test-receipts/2026-10-10-video-testing-mobile-packaging.json`.
3. On the authorized Mac, point to the unchanged analyzer checkout and run its frozen suite with existing ASR runtime. Cloud preserved F-003–F-006/P-002, but the full cloud replay has ASR-dependent failures; it is not a full regression PASS.
4. Establish/reuse the existing authorized HTTPS worker transport, set the three testing bindings and start the adapter. If no existing transport exists, report this one infrastructure gap before creating anything.
5. Obtain separate approval for normal existing GitHub→Cloudflare promotion; then enable the build guard deliberately, merge/deploy by the established path, and verify `/video-test/` on a phone without the admin password.
6. With Ashley's authorized real clip, verify upload → existing analyzer → exact source/time review → correction → restart/retrieval. Repeat with worker unavailable and a failed file. Creator acceptance and semantic accuracy remain separate from technical tests.

No deletion is implemented or authorized. Raw footage is never committed to GitHub or transferred to an external AI provider.
