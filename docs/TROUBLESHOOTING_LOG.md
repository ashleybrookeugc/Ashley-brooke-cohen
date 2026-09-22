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

## 2026-09-13 — Large calibration evidence JSON silently truncated during upload

### Symptom
A GitHub file-create action returned success for a generated evidence JSON, but the remote file was incomplete and could not be parsed.

### Root cause
Reading a 1.67 MB local file through `exec_command` returned only about 1,048,364 characters without an explicit truncation warning. The truncated tool output was passed to the GitHub create-file action.

### Verified fix
Compact the evidence package below the command-output cap (reduced-resolution representative frames, compressed full audio, compact JSON); parse the **entire** returned content and verify all 12 records before GitHub update. A subsequent branch-specific fetch parsed successfully with 12 records at source retrieval 2/2.

### Prevention rule
For large generated artifacts, compare expected byte/character count or parse the complete tool output **before** upload; then fetch and parse the remote artifact afterward. A successful GitHub write response alone does not establish file integrity. Never print base64 media into user-facing output.

---

## 2026-09-13 — Complete video retrieval was mistaken for comprehensive transcript/video understanding

### Symptom
The frozen 12-video calibration had complete source MP4s, full decoding, one-second full-resolution frame sampling, OCR, VAD, and multiple Whisper passes, yet the reconstructed transcript still dropped or altered small words and conversational structure. Ashley manually corrected examples including:

- “I don’t think it’s fair that my boyfriend gets more compliments than me.”
- “So something that I didn’t know about downtown Denver … a lot sketchy. You wouldn’t think that Denver has alleys.”
- a dialogue turn where Ashley says “It doesn’t seem like a good color,” her boyfriend says “Why not?”, and Ashley says “You think this is attractive?”

### Failed / insufficient approaches
- treating one-second OCR fragments as if they were a complete transcript;
- relying on multiple ASR passes as a substitute for exact source-grounded reconstruction;
- using `2/2` retrieval confidence as if it implied transcript/OCR certification;
- flattening visible caption fragments without preserving sentence continuity or speaker turns.

### Confirmed cause
The evidence representation was too shallow: OCR and ASR were treated as near-final evidence instead of raw modalities that must be synchronized and reconciled across time. The environment also could not directly audition the audio, so exact audible wording remained uncertified even when source files were fully decoded.

### Verified fix / architecture decision
`docs/PORTFOLIO_VIDEO_RESEARCH_SPEC.md` now requires a synchronized multimodal evidence timeline. Spoken transcript, burned-in captions, other on-screen text, speaker turns, visual actions/state changes, edits/inserts, and modality conflicts must remain separate but time-aligned. Exact connector words, negation, pronouns, qualifiers, and speaker attribution are material evidence when recoverable.

The shared canonical standard lives at:
`ashleybrookeugc/research-vault/shared-capabilities/video-understanding/EVIDENCE_STANDARD.md`.

### Prevention rule
Before later rubric scoring or analyzer claims:

1. verify complete source access separately from transcript/text fidelity;
2. record the verification modality explicitly (ASR, OCR, direct audition, subtitle-backed, etc.);
3. reconstruct adjacent captions into the actual sentence/turn instead of scoring isolated fragments;
4. preserve speech/caption disagreement rather than silently selecting one;
5. do not call a transcript “verified” when no direct audio audition occurred;
6. do not proceed from a one-line summary/evidence package as though it were comprehensive video understanding.

---

## 2026-09-21 — Metadata cache reported `COMPLETE` without decoding media

### Symptom
`/api/admin/video-analysis` returned `status: "COMPLETE"`, even though it had only fetched public oEmbed/page title and description metadata and then inferred creative fields from that text.

### Failed / unsafe premise
The route name and success state allowed an upstream metadata retrieval to be mistaken for complete-video analysis. The Cloudflare Worker has D1 and static assets but no raw-media binding or ffmpeg-capable execution path, so adding another Worker wrapper could not prove real-media decode.

### Root cause
One status field represented metadata retrieval, source-media coverage, evidence extraction, and analysis completion as if they were the same state.

### Verified fix
- Legacy URL results, including cached records, are now returned as `METADATA_ONLY` with an explicit evidence-scope warning.
- A separate local real-media foundation accepts direct files and direct-video URLs, computes a content hash, probes and decodes the complete source with ffmpeg, writes separate evidence lanes, and verifies the persisted package by reading it back and checking its digest.
- Tests prove direct-file and direct-media-URL intake plus negative cases for truncated input, read-back corruption, missing required evidence, bot/access blocking, removed sources, temporary failure, and retrievable non-video pages.

### Prevention rule
Do not use one generic `COMPLETE` state across retrieval layers. Record metadata retrieval, media decode coverage, each evidence lane, persistence/read-back, and safe-deletion eligibility independently. Do not claim a Cloudflare Worker can run a native-media primitive unless that exact runtime and binding path has been proven.

---

## 2026-09-22 — Local read-back verification was mistaken for remote durability

### Symptom
An evidence package could report a verified persistence read-back even though `.video-analysis/` is gitignored and exists only in the machine/workspace that performed extraction. A later authorized session could not resolve the package after loss of that environment.

### Root cause
One persistence state represented two different properties: local write integrity and survival/access outside the temporary processing environment. A digest-valid local read proved neither remote retention nor future authorized retrieval.

### Verified fix
- The manifest now records `persistence.local` and `persistence.remote` independently.
- Local packages explicitly report `scope: current_machine_or_workspace`.
- The safe-deletion gate requires remote write, remote digest-verified read-back, and an authorized future-session access state in addition to complete evidence lanes and local verification.
- A remote-store contract and negative corruption test exist, but no concrete provider is claimed until storage approval and real remote retrieval are completed.

### Prevention rule
Never translate `local.readback_state: verified` into “durable,” “canonical,” or “safe to delete.” Require a stable remote locator, read the package through the remote access path, reverify its integrity, and record that result separately. Do not promote an iCloud/Drive/R2 bridge or incur storage cost without the required owner approval.

---

## 2026-09-22 — A passing suite did not prove asynchronous upstream work was clean

### Symptom
The StepThrough upstream suite reported `116 passed, 3 deselected`, yet its warning output included detached background detection-thread failures (`no such table: detection_runs` and a foreign-key failure).

### Root cause
The test process could finish successfully while asynchronous work outlived fixture/database setup or teardown. Exit status and green assertion counts did not establish that the worker path was reliable.

### Verified fix / prevention rule
For every candidate and future harness run, record warnings and worker logs, join or explicitly observe bounded background jobs, and treat an unexplained asynchronous exception as outcome evidence. Do not promote a component from a green test count alone; inspect produced artifacts and the complete process output.

---

## 2026-09-22 — Work-environment model setup failure is not model-quality evidence

### Symptom
Two isolated Work attempts to run faster-whisper failed before model execution because the temporary Python environment lacked required SOCKS-proxy support during model download.

### Root cause
The failure occurred in temporary environment/network setup, not in decoding, model inference, ASR wording, or Apple Silicon execution.

### Decision / prevention rule
Classify this result as **UNTESTED — WORK ENVIRONMENT LIMITATION**. The two-attempt stop-loss applies: do not repeat the same setup route in this session. Run a pinned, cached-model benchmark on Ashley's Apple Silicon harness and separately assess operational success and gold-evidence quality before selecting an ASR engine.

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
