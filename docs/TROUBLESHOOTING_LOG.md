# Ashley Brooke Cohen Website — Troubleshooting & Recovery Log

This is the durable record for recurring failures, loops, misleading symptoms, and verified fixes in the `ashleybrookeugc/Ashley-brooke-cohen` website project.

## How to use this file

Before repeating deployment, Cloudflare, Worker, build, routing, or asset troubleshooting:

1. Check this log first.
2. Match the current symptom to a prior incident.
3. Re-test the previously verified fix before inventing a new workaround.
4. Distinguish the **first/root error** from downstream failures caused by it.
5. Do not tell the user to manually deploy or create new infrastructure unless the existing GitHub → Cloudflare path has actually been shown to be broken.
6. When a new issue is solved, add it here using: **Symptom → Failed/looping attempts → Root cause → Verified fix → Prevention rule**.

## 2026-10-09 — Ordinary conversation is still sent through a mutation router

**Symptom:** Production `Are you online?` became an invalid `ACTIVE_WORK.md` state proposal. The existing frozen acceptance rerun remains **8 PASS / 3 PARTIAL / 4 FAIL** after the isolated safety repair, with Muse comparison, Save key, assent, and idea deduplication failing.

**Cause found in source:** The only model interface requires `submit_control_route` and forbids an answer outside it. The service packet lacks recent-turn and pending-action context; the write contract has only two canonical targets. Thus a normal question is forced into classification/proposal output, and a rejected proposal can surface a technical validation error rather than an answer. The previous safety repairs address lost input and stale approvals only.

**Stop and prevention:** No conversational fix or production acceptance was verified. Adding phrase exceptions or prompt changes would not supply missing context, broad retrieval, Save key fan-out, or evidence-bound completion. Freeze independent multi-turn cases and prove one useful read-only turn plus one verified reconciliation through the existing authority/write gates before resuming promotion. Cached Wrangler 4.54.0 `whoami` explicitly reported unauthenticated, and the attempted fresh CLI install hit disk `ENOSPC`; no bindings or deployment were changed. See `docs/CONTROL_PLANE_TEST_REGISTRY.md` for the exact stop receipt.

## 2026-10-08 — Unqualified next-action query still reaches the model before the ambiguity stop

**Symptom:** In the current local control-plane implementation, the unqualified request `what is next?` reached the routing adapter even though several workstreams were current. A hostile test router returned a state proposal, but the later resolved-write-target gate stopped it with `ambiguous_scope`; no queue item, interaction history row, or canonical write was created.

**Confirmed root cause:** `createAmbiguityGate` blocks lexical multi-workstream matches and unbound continuation phrases, but an unknown non-continuation request such as `what is next?` currently returns `status: passed` with no bound section. The downstream write invariant is safe, but model dispatch is not prevented.

**Verified boundary:** Isolated service fixture: `router_calls: 1`, `error: ambiguous_scope`, `needs_ashley: []`, `ai_can_handle: []`, and `history: []`. This is a routing-boundary gap, not evidence of an unauthorized canonical write.

**Smallest justified repair:** Require an explicit workstream, or stop before model routing, for workstream-dependent unqualified requests such as `next`, `current action`, or state-update language when no unique authoritative section is resolved. Add a regression asserting that the router is not called and no interaction/queue row is created.

**Local repair verification (2026-10-08):** The deterministic pre-routing guard now blocks unqualified workstream-dependent requests when zero or multiple eligible sections exist, while allowing uniquely named workstreams and ordinary non-action conversation. The focused ambiguity/prior-state set passed 19/19; the full local repository suite passed 60/60. The independent frozen holdout covered Mary Kate, video, UGC, website, B-Paid, stale continuation, conflicting cross-project references, vague assent, explicit switches, and missing evidence. Blocked cases had zero router calls, history rows, or queue rows. This is local/test-only evidence; it does not establish deployment or production acceptance.

**Production observation boundary (2026-10-09):** An existing authenticated control-plane observation of `What's next?` in a multiple-eligible-workstream context returned `prior_state_ambiguous_scope`, with no visible waiting approval item and no new matching recent-outcome row. This supports the user-facing ambiguity result only. Cloudflare deployment lineage, exact zero model/router dispatches, before/after queue/history deltas, and canonical-write absence were not observable because the CLI required an unavailable API token and the dashboard session was unauthenticated. Keep the canary **UNVERIFIED** and do not submit a second request merely to obtain a stronger receipt.

**Canonical supersession (2026-10-09):** The latest Project Truth `ACTIVE_WORK.md` and Mary Kate test registry now preserve the prior unbound `What's next?` production canary as a separate **PASS**. The limited direct observation above remains preserved as provenance, but it is not the current canonical classification. The same latest state records a separate confirmed production false-ambiguity failure for `Do you think v1 of mk is complete?`; repair and regression-test that explicit read-only path before another production acceptance attempt.

**Prevention:** A downstream no-write invariant is not equivalent to a pre-routing ambiguity gate. Test both properties independently: ambiguous work must not dispatch, and a model-selected state proposal must not create a queue or write without a unique authoritative section.

## 2026-10-02 — Rejected model route disappeared before diagnostic capture

**Symptom:** one production request reached routing and returned `routing_contract_invalid`, but no interaction or diagnostic survived in D1. The original rejected route cannot be reconstructed reliably.

**Root cause of evidence loss:** `validateModelRoute` replaced the validator's specific error with a generic routing error. `capture` persisted interactions only after valid routing, so rejected candidates were discarded. This establishes the diagnostic defect, not the cause of the malformed production route.

**Repair:** preserve fixed validator path/reason, provider/model identity, and an allowlisted sanitized route projection in the existing `control_interactions.route_json`. Failed rows carry `outcome_status: failed` and a correlation ID, produce no queue item or write receipt, and remain inspectable through authenticated history and the separate technical-detail disclosure. Free-form text and unknown provider fields are omitted or represented by type/length. No D1 migration is required.

**Verification boundary:** focused diagnostic regressions and the complete relevant control-plane suite passed locally. Production activation and the original routing root cause remain unverified at commit time. The authenticated state response exposes `routing_diagnostics.version: control-routing-failure.v1` for activation verification before another request.

**Prevention:** preserve sanitized contract failure evidence before returning a routing error. Never manufacture a fixture for discarded production output, accept malformed output to advance a test, or claim a failed diagnostic row as a canonical write receipt.

---

## 2026-09-27 — Wrangler deployment replaced dashboard-only GitHub ID variables

### Symptom
The authenticated production state request still failed at GitHub installation-token creation after a new code deployment. The Cloudflare dashboard had previously shown the correct non-secret App and installation IDs.

### Confirmed root cause of the configuration drift
The GitHub-triggered build runs `npx wrangler deploy`. Its build log warned that the local Wrangler configuration differed from the dashboard configuration and that upload would override remote configuration. After the diagnostic deployment, Production settings no longer contained `CONTROL_GITHUB_APP_ID` or `CONTROL_GITHUB_INSTALLATION_ID`; the encrypted private-key secret remained present. This is a deployment-configuration failure, distinct from the still-unresolved GitHub token 403.

### Verified fix and boundary
The next deployment declared the same existing non-secret IDs in `wrangler.jsonc`. Its build log showed both bindings, and Production settings again showed App ID `4962733` and installation ID `165552010`. The active Worker still returned `GitHub App token 403`, so restoring the IDs did not establish the cause of that response. The production public key derived from the secret matched the independently verified local key; do not retry key replacement on this evidence.

### Prevention rule
Before a Wrangler deployment, compare locally declared runtime variables with the intended Production bindings. Do not rely on dashboard-only non-secret variables surviving a code deployment. Verify the active deployment and bindings after upload, and never infer secret contents from their encrypted dashboard presence.

---

## 2026-09-22 — Control-page script contained a literal escaped newline

### Symptom
Safari loaded the authenticated `/control/` document but issued no `/api/control/state` request. Its console reported `SyntaxError: Invalid escape in identifier`.

### Confirmed root cause
The inline script in `public/control/index.html` contained the literal characters `\\n` between two JavaScript statements (`refreshContext.onclick = …;\\nsend.onclick = …`). That is not a newline outside a JavaScript string, so Safari rejected the entire script before any startup code or network request could run.

### Relationship to the earlier blank-dashboard incident
This is separate from the earlier undeclared DOM-global failure. That prior defect was a runtime error after parsing; this defect prevented parsing altogether, so the later explicit DOM bindings could not execute.

### Verified fix
Replace the literal escape with a real line break and parse the complete embedded script in the regression suite. The regression also contains a deliberately malformed literal-escape fixture that must throw `SyntaxError`.

### Why existing checks missed it
The existing UI test only matched source strings, and the service tests use doubles. Cloudflare's Text-module packaging serves the inline script without JavaScript parsing, so its successful build did not validate browser script syntax.

### Proof boundary
The source and regression suite prove parseability. A real authenticated production reload must still prove that the state request is issued and separately establish its response, Project Truth read, D1 state, routing, and approval/write behavior.

### Prevention rule
For HTML that embeds executable JavaScript, parse the extracted script in CI and include a negative syntax fixture for the failure class before treating string-based UI checks or Worker packaging as browser-execution proof.

---

## 2026-09-22 — Private control-plane dashboard remained entirely blank

### Symptom
An authenticated visit to `/control/` rendered the private control-plane shell, but left the context line, Projects, Needs Ashley, AI can handle, and Recent outcomes blank.

### Confirmed root cause
`public/control/index.html` relied on browser-created globals for DOM elements. Two references did not match their element IDs: `refreshContext` was used for `id="refresh-context"`, and `contextStatus` was used for `id="context-status"`. The first `refreshContext.onclick = …` evaluation threw before `load()` executed. As a result, the browser did **not** call `/api/control/state`; the blank screen was not evidence of a D1, GitHub App, or Project Truth failure.

### Verified fix
Bind every control-plane DOM dependency explicitly with `document.getElementById(...)`, including the two hyphenated IDs, before registering handlers or calling `load()`.

### Proof boundary
This repair proves the frontend can now start its state request. It does not prove the authenticated production API response, GitHub App read, D1 state, model routing, or approval-write path. Those require the subsequent live smoke test.

### Prevention rule
Do not rely on legacy named-element globals in a private application UI. Bind each DOM element explicitly, and add a regression that locks IDs used by startup code before treating a blank screen as a backend failure.

---

## 2026-09-13 — Plan My Day quiz declared complete without visible itinerary proof

### Symptom
Ashley completed the conversational Build My Day quiz with a packed-day preference. Production showed only a “YOUR PLAN BRIEF” summary followed by the old saved-event instruction (“Tap Save on any event card to add it here”), with no personalized itinerary/results visible. Earlier testing had also produced only one suggested event when a multi-stop plan was expected.

### Observed failure
The implementation was described as fixed after code changes intended to make the quiz build a multi-stop itinerary, but the user-facing production screenshot still showed the old brief-only completion state. Therefore the claimed product outcome was not proven.

The screenshot also displayed a time window as `10:35–01:35`, which is ambiguous to a user and may represent a same-day AM/PM interpretation problem. The intended interpretation was not recovered from source evidence, so the time-parsing root cause remains unconfirmed.

### Confirmed cause / unknowns
The earlier quiz implementation definitely generated a preference brief and dispatched preferences; the existing saved-event planner remained a separate suggestion surface. That architectural mismatch explains why the first quiz version did not itself satisfy “Build My Day.”

For the later attempted repair, the exact reason production still rendered the old state is **unknown** in this session. Possible causes such as deployment lag, cached asset, JavaScript failure, or an incomplete renderer hookup were not independently verified and must not be recorded as fact.

### Failed approaches / traps
- Treating a preference-summary screen as completion of an itinerary-building feature.
- Treating a GitHub code change/cache-bust as proof that the browser-visible product behavior was fixed.
- Reusing the old saved-event suggestion model for a quiz whose user promise is a complete personalized day.
- Saying the planner now builds a multi-stop itinerary before verifying that a real quiz completion visibly renders those results on production.

### Verified fix
**Not yet verified.** This incident remains open. Do not mark it repaired until production evidence shows the actual itinerary directly after quiz completion.

### Smallest regression / proof required
On the live production page:
1. Open Plan My Day / Build My Day.
2. Choose a day with multiple eligible events, a broad time window, `Pack my day`, and permissive travel/budget constraints.
3. Complete the quiz.
4. Verify that the completion state visibly contains an itinerary/results section—not only the plan brief and not only the old “Tap Save” instruction.
5. Verify more than one stop when at least two source-supported events genuinely fit the hard constraints; if only one fits, the UI must explain the limiting constraint rather than silently returning one.
6. Verify displayed times are unambiguous to a normal user (AM/PM or an equally clear convention) and that end-before-start input is handled intentionally rather than guessed.

### Prevention rule
For user-facing feature work, **the acceptance criterion is the promised browser-visible outcome, not the presence of new code or an emitted event.** A feature that says “Build My Day” is not complete until a production run from inputs through visible itinerary output is proven. Keep preference collection, itinerary generation, and itinerary rendering as separately testable primitives.

---

## 2026-09 — GitHub → Cloudflare deployment confusion

### Symptom
Changes were pushed to GitHub, but a work session repeatedly implied that the user needed to manually deploy/promote the Worker or make additional Cloudflare changes.

### What caused the loop
The troubleshooting path treated deployment as if GitHub and Cloudflare were separate manual steps instead of first verifying the repository's existing deployment wiring.

### Verified state / fix
`main` is wired to Cloudflare Workers Builds and commits to `main` auto-deploy. Manual promotion is not normally required.

### Prevention rule
Before giving any manual deployment instructions:

- verify that the intended commit exists on `main`;
- allow/inspect the Cloudflare build triggered by that commit;
- compare the live site against that commit;
- only troubleshoot Cloudflare deployment configuration if the live deployment genuinely does not match `main`.

**Do not create a second deployment path, new repo, paid Cloudflare feature, or manual promotion workflow as a default workaround.**

---

## 2026-09-10 — Search committed to `main` but not visible on refreshed production site

### Symptom
A new event keyword-search field and its script were committed to `main`. Repository inspection confirmed that `public/nyfw-pop-ups/index.html` contained the search input and `event-search.js` reference, but Ashley refreshed the production website and still could not see the search UI.

### Failed / misleading approach
The implementation was initially described as effectively done because the GitHub commit existed. A later response also characterized the problem as a cache/deployment-freshness issue before the actual Cloudflare build/deployment state had been inspected.

### Confirmed cause
**Unknown from the preserved session evidence.** The conversation proved a mismatch between GitHub `main` and what Ashley saw in production, but it did not independently establish whether the cause was a queued/missed Cloudflare build, deployment lag, stale edge/browser content, Git integration state, or another production-layer issue.

### Verified fix / proof boundary
The repository source was verified on `main`, and an additional commit changed the search asset version to create a fresh production-build signal. The session did **not** preserve a final production screenshot or fetched live page proving that the search field appeared afterward.

Therefore the durable verified state is:
- source implementation existed on `main`;
- Ashley's live refresh did not initially reflect it;
- a new `main` commit was made to retrigger/freshen the deployment path;
- final live success was not proven in this session.

### Prevention rule
Do not use `commit exists on main` as the completion receipt for production UI work.

For a user-visible website change, verify these layers separately:
1. source exists in the intended repository file;
2. intended commit exists on `main`;
3. Cloudflare created/ran the corresponding production build/deployment;
4. production serves the expected HTML/asset version;
5. the changed UI/behavior is actually visible/usable in production.

If step 2 passes and step 5 fails, stop calling the feature live. Inspect the deployment/build layer before asserting a cache cause or repeatedly bumping asset versions.

Smallest regression: after any production-facing UI commit, verify one distinctive changed DOM string or asset version from the live production URL before declaring success.

---

## 2026-09-11 — Cloudflare failed-build cascade / export error

### Symptom
A run of Cloudflare builds appeared to fail repeatedly. The visible build log contained an earlier export/build error, while later failure messages made the problem look broader than it was.

### What went wrong
Troubleshooting focused too much on repeated failed builds/downstream symptoms instead of treating the earliest export error as the likely root failure.

### Root cause
The exact original export error text is not preserved in this document yet, so this entry does **not** claim a reconstructed technical root cause beyond what was directly observed: an export/build error occurred before the subsequent failed-build cascade.

### Verified lesson
Fix the **first deterministic compile/export error** before changing Cloudflare settings or treating every later failure as an independent problem.

### Prevention rule
For Cloudflare build failures:

1. Read the log from the first actual error, not the final `build failed` line.
2. Identify the earliest file/module/export/import error.
3. Fix that code error locally/in GitHub first.
4. Re-run one clean build.
5. Only investigate Cloudflare account/deployment configuration if the code build succeeds but deployment still fails.

Never respond to a cascading build failure by repeatedly changing unrelated configuration.

---

## 2026-09 — Admin page / login 404 and secret-variable loop

### Symptom
The admin/login flow was reported as implemented, while the live route still returned a 404 or login did not work even after a secret variable was added.

### Failure mode
The session trusted the intended implementation state instead of verifying the actual production route and deployed Worker behavior.

### Recovery rule
For admin/auth problems, verify in this order:

1. Does the route exist in the repository/Worker code?
2. Is that exact commit on `main`?
3. Did Cloudflare build/deploy that commit?
4. Does the production URL resolve to the expected route rather than a static-site 404?
5. Only after the route is confirmed live, debug secret names, bindings, cookies, and authentication behavior.

### Prevention rule
**Do not debug a password/secret against a route that has not first been proven to exist in production.** Route/deployment verification comes before auth debugging.

---

## 2026-09 — Cloudflare build-time secrets mistaken for Worker runtime secrets

### Symptom
The moderation login still rejected the configured admin password even though Cloudflare's **Settings → Builds → Variables and secrets** screen visibly contained `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET`.

### Failed / looping approaches
- Repeatedly treating the presence of those names in the Builds UI as proof that the Worker could read them at runtime.
- Continuing to debug password/auth behavior before distinguishing build environment variables from runtime Worker bindings.
- Earlier in the same loop, treating repository/local implementation and successful build/upload as equivalent to verified production behavior.

### Confirmed cause
The secrets shown under **Builds → Variables and secrets** are build-time values. The Worker login code reads `env.ADMIN_PASSWORD` and `env.ADMIN_SESSION_SECRET` at request runtime, so those secrets must exist as Worker runtime secrets/bindings and be deployed with the Worker configuration. Build-time secret presence is not runtime-secret presence.

### Verified fix / proof boundary
The correct remediation is to create `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` as runtime Worker secrets, deploy that binding change, then test the real `/admin/login` route. The session verified the code contract in `src/worker.js`: the login compares against `env.ADMIN_PASSWORD`, signs the session with `env.ADMIN_SESSION_SECRET`, sets an `HttpOnly; Secure; SameSite=Strict` cookie, and redirects to `/moderation/` after successful authentication.

This session did not preserve a final screenshot proving the post-fix login succeeded, so the **configuration cause is confirmed but the final production-login success is not claimed here**.

### Prevention rule
For Cloudflare Worker auth/configuration debugging, keep these layers separate:

1. **Repository state** — code/config exists.
2. **GitHub main state** — intended commit is on the production branch.
3. **Build state** — Cloudflare successfully built/uploaded it.
4. **Production traffic state** — the expected Worker version is actually serving production traffic.
5. **Runtime binding state** — Worker runtime secrets/bindings exist in the deployed environment.
6. **Application behavior** — the live route/login/API behaves correctly.

Never use a green check at one layer as proof of the next layer. In particular, **build-time variables are not Worker runtime bindings**.

Smallest regression: before changing auth code, request `/admin/login` in production and separately verify the two runtime secret names exist in the Worker runtime settings. If either primitive is missing, stop there rather than rewriting authentication.

---

## 2026-09-13 — Admin auth wrapper changed a working password path

### Symptom
Ashley entered the same admin password that had worked the prior day, but the newly added wrapper displayed `Incorrect password`. She explicitly said the secret value had not been changed.

### Failed / looping approach
The wrapper introduced its own secret-resolution/password-comparison layer while the original Worker's authentication code had already been working. The first interpretation over-read the new error message as evidence about the stored secret rather than treating the newly introduced wrapper as the first suspect.

### Confirmed cause / unknowns
The regression was localized to the custom wrapper path: after the wrapper's secret normalization/custom authentication logic was removed and requests were delegated back to the original Worker's authentication code with the untouched Cloudflare `env`, Ashley successfully logged in and reported `Ok I’m in`.

The exact low-level reason the wrapper's comparison differed is **not preserved/verified**, so do not claim a specific Cloudflare secret encoding/coercion bug.

A separate routing defect also existed: `run_worker_first` included `/admin/*` but not the exact bare `/admin` path, so `/admin` could bypass the Worker and return a static 404. The configuration was updated to include both bare and wildcard admin/moderation routes.

### Verified fix
- Keep the auth wrapper thin: bare `/admin` routing only; delegate login/session authentication to the original Worker.
- Pass Cloudflare runtime bindings through unchanged.
- Include exact bare routes as well as wildcard routes in `assets.run_worker_first` where both forms must execute Worker code.
- Production proof captured in-session: Ashley successfully entered the admin after the wrapper rollback.

### Smallest regression / proof
1. Request `/admin` and confirm it reaches the Worker/login flow rather than static 404.
2. Submit the known-good password through `/admin/login`.
3. Confirm redirect to `/moderation/` and a usable moderation page.
4. Do not rewrite secret handling if those primitives already work.

### Prevention rule
When fixing routing around a previously working security primitive, **do not replace the primitive at the same time**. Intercept only the route that needs interception and delegate the rest unchanged. If behavior regresses immediately after a wrapper is introduced, compare against the previously working path before blaming user configuration.

---

## 2026-09-13 — Moderation actions appeared to do nothing

### Symptom
A moderation action button could be clicked but the card appeared unchanged. In the same UI, the global `Run discovery + reverification now` control was also mistaken for a pending-submission verifier because its scope was not clear.

### Confirmed code defect
The action handler set the requested status from the clicked button and then overwrote it with the current status dropdown value before issuing the PATCH. A click such as Approve/Reject/Mark under review could therefore send the existing `pending` state back to the server.

### Repair committed
The button-action logic was changed so the clicked action remains authoritative, with visible `Saving…` / saved / failure feedback. The moderation workflow was also split conceptually:
- discovery + recheck published sources;
- per-submission `Verify submitted source`;
- queue-wide source checking.

The per-submission and queue-wide source checks use the submitted source URL; they do not claim to verify every event fact automatically.

### Proof boundary
The code cause is confirmed from repository inspection. A separate live production click proving every moderation action after the fix was **not preserved in this session**, so do not overstate end-to-end verification.

### Prevention rule
For admin controls, the clicked action must be the source of truth for that request unless the UI explicitly requires a separate confirmation field. Every asynchronous admin action should expose progress and a terminal success/failure state; silent no-ops are not acceptable diagnostics.

---

## 2026-09-13 — Queue source checks mislabeled bot-blocked sources as failures

### Symptom
After Ashley requested a button to check submission-queue sources, the queue summary reported that all sources had failed.

### Confirmed cause
The verifier treated `response.ok === false` as equivalent to source failure. Server-side Cloudflare fetches to bot-protected platforms such as Instagram, TikTok, Facebook and Eventbrite can be blocked/challenged even when the link works normally for a user. Those transport outcomes were being collapsed into `failed`.

### Repair committed
The verifier/status model was changed to distinguish:
- automatically verified/reachable;
- manual verification required because automation was blocked/challenged;
- unavailable/removed (for example 404/410);
- temporarily unavailable/inconclusive network or 5xx failure;
- content flags such as cancellation, sold out, waitlist or closed language.

The queue summary was updated to report these categories separately.

### Proof boundary
The classification defect and code repair are confirmed. The session did not preserve a final screenshot of a post-deploy queue run, so live platform-by-platform behavior remains subject to verification.

### Prevention rule
**Automated retrieval failure is not source-invalid evidence.** Keep transport capability, source existence, content signals and human verification status separate. Never let a bot challenge become a false-negative content judgment.

---

## 2026-09-13 — Event detail route still returns generic `Temporarily unavailable`

### Symptom
Clicking `View details` on Pop-Up Radar events repeatedly produced the legacy Worker text response `Temporarily unavailable. Please try again.`

### Failed approaches / attempted repairs
Several bounded repairs were committed during the session:
- refreshed `public/assets/event-detail.js` feed coverage and fixed an earlier malformed expression;
- intercepted `/nyfw-pop-ups/event/<occurrence-id>/` in the auth/front wrapper;
- after Ashley still reproduced the 503, added `src/router-worker.js` to recognize path-ID and query-ID event detail URL forms before delegating to the legacy Worker;
- updated `wrangler.jsonc` so `main` is `src/router-worker.js` and `run_worker_first` includes bare `/nyfw-pop-ups/event`, `/nyfw-pop-ups/event/*`, and `/nyfw-pop-ups/event.html`.

### Confirmed cause
**Not yet confirmed.** The generic response definitely originates from the legacy Worker's top-level catch when a non-API request throws, but this session did not capture the actual production exception or prove which request shape/runtime path was still reaching that catch.

Do not record `query-form mismatch`, cache, deployment lag, or a particular event feed as the confirmed root cause. Those were hypotheses/attempted repairs, not proven causes.

### Current repository state
As of the final preservation check on 2026-09-13:
- `wrangler.jsonc` points `main` to `src/router-worker.js`;
- the router supports `/nyfw-pop-ups/event/<id>`, `/nyfw-pop-ups/event?id=...`, `/nyfw-pop-ups/event/index.html?id=...`, and `/nyfw-pop-ups/event.html?id=...`-style query IDs;
- the router serves an event-detail shell using `public/assets/event-detail.js` and delegates other requests to `src/auth-worker.js`;
- **the final router change was not live-verified by Ashley in this session**.

### Smallest next diagnostic / regression
Before another architectural change:
1. capture one exact failing production detail URL from a current tracker card;
2. request that exact URL and record status/body plus a distinctive router-shell marker/asset version;
3. verify whether production is serving `src/router-worker.js` for that request;
4. if the router shell is served, inspect the first failing asset/feed request rather than changing Worker routing again;
5. if the legacy generic 503 is still returned before the shell, inspect production deployment/build/runtime logs for the first exception and compare the live deployed Worker version with `main`.

### Prevention rule
After two failed routing fixes, stop broadening regexes/wrappers without production evidence. **A route that looks correct in repository code is not proof that production traffic reached it.** Verify the exact failing URL and the first failing layer before the next change.

---

## 2026-09 — Event-site work and portfolio work becoming visually/technically conflated

### Symptom
The portfolio homepage inherited visual language and assumptions from the NYFW / NYC Pop-Up Radar even though they are different products on the same domain/repository.

### Root cause
Shared repository and shared CSS encouraged treating the portfolio and event utility as one visual system.

### Fix / architecture rule
Keep the experiences separate:

- Event/Pop-Up Radar: functional utility UI and its established event styling.
- Ashley portfolio: editorial personal site using warm ivory, charcoal, ink navy, deep plum/prune, and forest/emerald accents.
- Portfolio pages use their own `portfolio.css` rather than restyling event pages globally.

### Prevention rule
Do not globally change event-site colors/components when building the portfolio. New portfolio styling should be scoped to portfolio pages.

---

## 2026-09-11 — Production stills were accidentally regenerated instead of cropped

### Symptom
The user asked only to remove black horizontal bars from acting stills. An image-generation edit changed faces and scene details.

### Root cause
A generative image-editing workflow was used for a deterministic crop task.

### Verified fix
Return to the original screenshots and crop them pixel-for-pixel. Do not regenerate faces, bodies, wardrobe, lighting, or scene content.

### Prevention rule
For authentic portfolio evidence (film/TV/commercial stills, headshots, production images):

- cropping, resizing, compression, and non-generative presentation edits are allowed by default;
- do **not** use generative editing unless the user explicitly requests a creative alteration;
- production stills should remain evidentiary/authentic.

---

## 2026-09-11 — Portfolio binary-image upload interruption

### Symptom
Portfolio HTML/CSS pages were successfully created on the `portfolio-v1` branch, but the build process stalled when moving locally available photos/stills into GitHub as binary assets.

### Root cause
The normal GitHub text-file actions used for HTML/CSS are not the same workflow as adding local binary image files. Starting the page build before confirming the binary asset path created an avoidable interruption.

### Current recovery state
The original user images and corrected cropped stills remain available in the active project conversation/runtime. The portfolio pages were intentionally kept on a separate `portfolio-v1` branch so incomplete image references would not affect production.

### Prevention rule
Before wiring image paths into a large portfolio build:

1. confirm the repository method for binary assets;
2. upload one test image successfully;
3. verify it can be fetched/rendered from the branch;
4. then batch-integrate the remaining assets;
5. merge only after checking every referenced asset path.

Do not merge a visual build that contains unverified/broken image references.

---

## 2026-09 — Source-of-truth drift during portfolio design

### Symptom
Later design suggestions drifted from the already-researched website direction—for example, repeatedly reopening hero/tagline decisions and initially selecting a styled green-dress portrait as the primary identity image even though that hairstyle is not Ashley's normal look.

### Root cause
The conversation continued generating fresh portfolio conventions rather than re-reading the project source/document that already preserved the agreed website research and preferences.

### Verified fix
Use the project website source document as the authority for portfolio architecture and aesthetics. Treat later improvisations as drafts unless they explicitly supersede the source.

### Prevention rule
Before major portfolio design/copy changes:

- re-check the website source document;
- preserve Ashley-first digital-calling-card structure;
- use current/natural appearance for identity/hero imagery;
- use alternate styled looks as range, not as the default identity;
- keep copy human, concise, specific, and non-generic;
- do not restart decisions that are already settled unless Ashley asks to revisit them.

---

## Stop-loss protocol for future loops

If the same failure is encountered **twice after applying the same class of fix**, stop repeating the attempt.

Instead:

1. State what is known to work.
2. State the exact first failing step.
3. Compare against this troubleshooting log.
4. Re-check repository state and deployed state separately.
5. Change one variable at a time.
6. Record the verified resolution here before moving on.

The goal is to prevent a session from spending multiple turns rediscovering a solved problem or layering workarounds on top of a wrong diagnosis.
# 2026-10-09 — Explicit Mary Kate read-only assessment resolution

**Symptom:** Production rejected `Do you think v1 of mk is complete?` as ambiguous. Canonical failure: research-vault `shared-capabilities/ai-workflows/failures/2026-10-09-explicit-mk-status-question-false-ambiguity.md`. The separate production `What's next?` PASS is preserved.

**Local reproduction / limits:** At base `5df0a6d3d0b614f814e95a6dee740272e4c9cb74`, vault snapshot `899ea1d222d47dd612fd4efb9dd7a3cce8af7af5`, the exact MK phrase passes the initial gate with no bound section; `Is Mary Kate V1 complete?` blocks on the reconciliation and operating-system headings. A state-update candidate for the exact MK phrase then reproduces the reported downstream `authoritative-ambiguity.v1` empty-evidence block. Production candidate/dispatch telemetry was not recovered, so this does not establish which production path fired. The first six new regression groups failed before repair. One initial alias substitution also broke three existing fully named action tests; preserving full `Mary Kate / AI operating system` names corrected that regression.

**Confirmed local cause:** No MK alias; heading overlap confuses project projections; no read-only assessment contract. Smart apostrophes also bypassed the unbound-next recognizer locally.

**Verified development repair:** Implementation `97e38b5848aa63bf7cc3825916a1af26d5d8c0a2`, branch `mary-kate/explicit-readonly-resolution`. Normalize ordinary aliases and apostrophes; prefer the operating-system projection only for a read-only assessment without another named project; retain exact projection names and action ambiguity. Retrieve completion evidence through `PROJECT_INDEX.md`'s existing completion route with source SHAs. Require current evidence and reject all action/decision/proposal outputs for an assessment before queue/history storage. Valid answers retain ordinary interaction history plus retrieval provenance; no canonical write or approval is created.

**Verification:** Apple M4 Pro, arm64: full Node suite **68/68 PASS**, focused ambiguity/prior-state/read-only suite **27/27 PASS**, Worker packaging dry-run PASS. Eight new groups include six frozen positive paraphrases, cross-project/mixed-action negatives, missing/conflicting authority, hostile state/side-idea/decision outputs, and the actual Workers AI adapter with a provider double. Real vault-snapshot replay follows ACTIVE_WORK → PROJECT_INDEX → indexed completion matrix; one adapter call for the MK question, no additional call for smart-apostrophe `What’s next?`, zero approval rows/canonical writes. No live model-quality or production success is claimed. Frozen unrelated Qwen/compiler benchmarks were not repeated.

**Prevention / continuation:** Assessments are retrieval, not action authorization. Alias selection cannot widen permission. Merge/deploy and one authenticated explicit-MK canary remain pending separate authorization; do not repeat the passing unbound-next canary. Preserve router count, source/Worker lineage, queue/history deltas and canonical-write telemetry for that single canary. Full V1 mutation acceptance remains separate.

**Expanded counterexamples and repair:** The recovered development implementation still blocked `What’s left for MK?` and polite readiness paraphrases. A newly frozen 23-case set measured six unnecessary clarifications and two unsafe routing acceptances: a second explicit project could lose token-score competition, and `Ship it` could borrow assessment disambiguation. No queue or canonical write occurred in those test runs. Commit `2ada581e6f374ccf4dfa59faa37b817bde804375` recognizes ordinary remaining-proof/status language, excludes the additional action forms, and detects distinct explicit project names before scoring. The unchanged holdout passes 23/23 with both counters zero; full 69/69 and focused 28/28 pass. No implementation fix iteration failed in this continuation. Exact receipts: `docs/test-receipts/2026-10-09-explicit-mk-readonly.json`. The existing vault failure also records the evidence-supported earlier-session stopping audit. Production telemetry and live answer quality remain pending; configuration and bindings are preserved.
## 2026-10-09 — Herdr adapter must establish its own headless server and trusted Codex baseline

The first real adapter acceptance reached no Codex worker: a new named Herdr session returned `server_not_running` at workspace creation. Herdr API commands do not create that session's headless server. The isolated acceptance runner now creates only its own temporary Herdr config/runtime directories, starts `herdr server`, waits for `api snapshot`, runs the adapter, and stops that server. Do not attach the adapter to an unrelated Herdr session or treat a missing server as a worker failure.

The next attempted runner invocation also reached no server or worker because duplicate JavaScript identifiers caused a parse-time error. `npm run check:herdr-acceptance` now parses the actual runner before use. After both bounded setup repairs, one real worker produced Herdr lifecycle evidence `idle → working → completed`, then `disconnected` after its owned workspace closed. The global Codex config hash stayed at the separately recorded Project Truth baseline. Never derive-and-accept a new baseline inside the adapter, silently rewrite shared Codex configuration, or translate Herdr `unknown`/absence into `running`.

## 2026-10-09 — Isolated Herdr runtime paths need disk headroom and a short socket path

**Symptom:** The first local-interface acceptance stopped before server readiness and before any worker launch. The captured foreground error was `No space left on device`. After only regenerable dependency caches were removed, a diagnostic using the original long temporary root exposed a second pre-launch error: the Unix-domain socket path exceeded `sockaddr_un.sun_path` capacity.

**Confirmed causes:** The Mac data volume had insufficient writable headroom for Herdr's runtime state, and the acceptance prefix plus nested XDG runtime path was too long for a local Unix socket. Neither error was a Codex-worker failure, adapter-state failure, or evidence about an external session.

**Verified fix:** Preserve repositories/evidence, remove only disposable package/dependency caches, require a successful bounded write before launch, and use a short isolated root (`/private/tmp/mk-hui-*` with short `c`, `s`, `r`, and `w` subdirectories). The corrected run started its own server and passed the complete UI lifecycle. The runner syntax is checked before execution.

**Prevention:** Before a disposable Herdr acceptance, verify writable disk headroom and keep the complete XDG runtime/socket path comfortably below the platform limit. Stop before worker launch on either failure; do not treat repeated server startup as worker evidence, attach to an unrelated session, delete project evidence, or weaken isolation to make the test green.

## 2026-10-09 — Workflow acceptance exposes lost captures and stale approvals

**Symptom:** The existing production creative-idea rejection is documented in vault main `9c089f4`. An isolated workflow acceptance at website main `05571bad1b61dee1871367bee3e136ce11f87d25` independently reproduced loss of original input on invalid routing, and found that an approval could overwrite canonical state changed since the proposal was prepared. Save key, assent and Muse comparison also lack required runtime context/capabilities. These are not all instances of ambiguity and are not solved by a routing PASS.

**Attempts/root cause:** One bounded baseline, then two narrow source repairs. Routing diagnostics deliberately persisted sanitized shapes while replacing original `raw_text` with an omitted placeholder, losing recovery data. Approval used the latest SHA for conditional PUT but did not bind to the version used for proposal review. This protects a concurrent PUT race, not a stale authorization. Five new regressions failed before repair. An intermediate full-suite failure was a fixture returning a different SHA on each unchanged read; fixed immutable-blob simulation, retaining all original expected outcomes. No source-fix loop or stop-loss exhaustion.

**Verified development repair:** `181eff651ee9f5d84c3e38e20e9d768c5e366998` on `mary-kate/workflow-adherence`. Keep originals only in existing private `raw_text`; diagnostic sanitization remains tested and canonical targets are never guessed/coerced. Service-assigned `retained_private` distinguishes failed promotion from lost input. Bind reviewed target SHA in existing proposal JSON; stale/unversioned pending approvals fail closed before writing. ACTIVE_WORK cache invalidates on stale approval. Existing verified-operation replay remains idempotent. No schema/configuration/allowlist changes. Unversioned old pending approvals need fresh proposals; whole-file version changes conservatively require renewed review.

**Evidence/prevention:** Focused 16/16, full 74/74, existing 23-case language holdout safe, Worker dry-run PASS. Original/post reports and raw outputs: `docs/test-receipts/2026-10-09-workflow-adherence.json`. Baseline 6 PASS / 3 PARTIAL / 6 FAIL; after 8 / 3 / 4; **overall workflow FAIL**. Four open failures are missing Muse authority/context, missing Save key reconciliation with accepted unsupported success prose, missing immediate-action context for assent, and duplicate idea capture. Controlled provider outputs do not prove understanding or a useful actual response. Private retention is not canonical preservation or an implemented recovery UI. Pre-routing and later read-only/target-enforcement failures are outside this narrow retained-input path. Do not widen targets or stamp a product PASS to hide these gaps. No production test/deployment performed. Canonical detailed finding and continuation: vault `shared-capabilities/ai-workflows/failures/2026-10-09-workflow-adherence-capture-and-review-gaps.md`, reachable from its existing registry and failure index.
