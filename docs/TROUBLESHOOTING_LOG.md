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
