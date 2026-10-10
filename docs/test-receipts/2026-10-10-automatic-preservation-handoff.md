# Automatic preservation + fresh-worker handoff — isolated receipt

**Status:** PASS — frozen isolated fixture; not production acceptance  
**Date:** 2026-10-10  
**Frozen contract:** `scripts/acceptance/automatic-preservation-handoff-cases.json` at `23665ea`  
**Scope:** disposable in-memory Project Truth only; no external model or GitHub mutation

## Commands and observed results

1. `node --test test/control-automatic-preservation.test.js` — **8/8 PASS**.
2. `npm test` — **103/103 PASS**.
3. `npm run check:worker` — **BLOCKED**: `wrangler` is not installed in this checkout (`sh: wrangler: command not found`). This is not recorded as a packaging pass.

## Primary fixture proof

The Ashley decision “The video analyzer should prioritize accurate source timestamps over processing speed” entered with automatic preservation enabled, not a save command. The route targeted the fixture Video analyzer `ACTIVE_WORK.md` field; the service confirmed the indexed destination and exact old canonical value, used existing `ai_can_handle` authorization, conditionally wrote, reread byte-for-byte, and stored a verified receipt. A separate service with a new empty memory store reread Project Truth and passed the preserved value to the handoff verifier. It had no original conversation turn.

## Negative proof

The same fixture independently rejects duplicate commits for already-canonical data; silent conflict overwrite; missing index route; GitHub write failure; dropped worker instruction; unapproved consequential mutation; and temporary non-durable conversation. Failures create failed/pending receipts instead of a saved claim.

## Boundaries

The router is a controlled fixture, so this proves the preservation/handoff connection and its deterministic gates, not live semantic classification quality. No deployment, production request, real Project Truth document, real GitHub write, merge, or credential/binding change occurred.
