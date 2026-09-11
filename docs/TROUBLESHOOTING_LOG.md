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
