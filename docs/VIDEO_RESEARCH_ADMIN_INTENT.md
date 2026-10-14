# Planned private video-research admin flow

**Status:** founder-approved workflow intent; not implemented

## Canonical shared source

Cross-project video-understanding architecture, evidence standards, native-upload findings, boardroom/recipe behavior, and raw-video lifecycle are canonical in:

`ashleybrookeugc/research-vault/shared-capabilities/video-understanding/`

The staged implementation authority is `shared-capabilities/video-understanding/V1_IMPLEMENTATION_PLAN.md`. Mary Kate is the single conversational intake, progress, approval, and delivery surface over that shared capability; the website does not become a separate Video Studio.

Do not duplicate that research here. This file records only the website-specific projection.

## Website-specific intent

Ashley wants a private `/admin`-style front end on the existing website/admin system that lets her select a screen recording or draft from iPhone Photos with minimal friction and send it into the shared video-understanding workflow.

Desired UX:
- one obvious upload action;
- direct Photos selection when supported;
- optional plain-English context, not required recipe configuration;
- visible upload / analysis / archive state;
- structured evidence and findings written to the private research vault;
- raw screen recordings treated as disposable processing input, not permanent cloud storage;
- no large raw screen recordings committed to GitHub;
- temporary processing copy deleted only after evidence archival is verified;
- only after that verification may the UI say the original is safe to delete from the phone.

## Implementation boundary

This file does **not** claim that the current website already has this upload/processing path. Before implementation, verify current Worker/admin architecture, authentication, file-size/runtime limits, temporary upload mechanism, and current AI/video API/file capabilities. Follow `docs/TROUBLESHOOTING_LOG.md` and the research-vault staleness rules rather than assuming an earlier architecture is still current.

## 2026-10-10 — Approved analyzer testing loop

The required first frontend is select/upload → existing analyzer → actual source-time review → persistent correction, without the admin password. PR #5 at f272b5a1 is a historical-receipts viewer; it does not satisfy this workflow and signed admin acceptance is not the next prerequisite. The separate `/video-test/` implementation is prepared on an isolated branch. See `tools/video-testing/README.md` and `docs/test-receipts/2026-10-10-video-testing.json` for exact security, test, activation and remaining acceptance details. No merge/deploy or full feature PASS is claimed.

Failure prevention: technical passes, admin receipt rendering and code existence cannot substitute for the promised phone workflow. Cloud real-synthetic extraction and persistent correction tests pass; actual browser/iPhone, live transport, packaging and Mac acceptance remain unverified. Existing analyzer source/tests remain untouched. Tesseract readiness initially used the wrong `-version` spelling, causing false unavailability; `--version` repair is covered by real extraction. A DOM test-double hang was corrected by passing structuredClone one argument rather than Array.map's index/options; this is test-harness evidence, not a product failure.
