# Planned private video-research admin flow

**Status:** founder-approved workflow intent; not implemented

## Canonical shared source

Cross-project video-understanding architecture, evidence standards, native-upload findings, boardroom/recipe behavior, and raw-video lifecycle are canonical in:

`ashleybrookeugc/research-vault/shared-capabilities/video-understanding/`

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
