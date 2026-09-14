# Ashley Brooke Cohen

Static personal site with the NYFW Pop-Up Radar at `/nyfw-pop-ups/`.

## Before making website changes

Read `AGENTS.md` and `docs/TROUBLESHOOTING_LOG.md` first. The troubleshooting log is the durable record of solved loops, verified fixes, deployment rules, and prevention rules. Do not repeat a documented failed approach.

## Update the tracker

Edit the applicable event feed under `public/data/`. Shared event facts live in `events`; each open date lives in `occurrences` with its own date, hours, availability, and optional date-specific details. Keep RSVP requirement separate from direct-link actionability and availability. Preserve sources, verification, classification, location, subway, caveats, and notes.

Occurrence detail links use stable URLs under `/nyfw-pop-ups/event/<occurrence-id>/`. Production routing is currently handled by the Worker entrypoint declared in `wrangler.jsonc` (`src/router-worker.js` as of 2026-09-13), which intercepts supported event-detail URL forms and serves the detail shell before delegating all other requests. Do not assume a per-occurrence static route directory is required; inspect the current router, `wrangler.jsonc`, tracker link generation, and event-detail feed coverage before changing this subsystem.

Commit changes to `main`; Cloudflare Workers Builds deploys automatically.

## Local preview

```sh
npm install
npm run dev
```
