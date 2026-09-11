# Ashley Brooke Cohen

Static personal site with the NYFW Pop-Up Radar at `/nyfw-pop-ups/`.

## Before making website changes

Read `AGENTS.md` and `docs/TROUBLESHOOTING_LOG.md` first. The troubleshooting log is the durable record of solved loops, verified fixes, deployment rules, and prevention rules. Do not repeat a documented failed approach.

## Update the tracker

Edit `public/data/events.json`. Shared event facts live in `events`; each open date lives in `occurrences` with its own date, hours, availability, and optional date-specific details. Keep RSVP requirement separate from direct-link actionability and availability. Preserve sources, verification, classification, location, subway, caveats, and notes.

Each occurrence has a matching stable static route at `public/nyfw-pop-ups/event/<occurrence-id>/index.html`. When adding or removing an occurrence, add or remove its matching route directory by copying any existing occurrence page template and changing only the `data-occurrence-id` value.

Commit changes to `main`; Cloudflare Workers Builds deploys automatically.

## Local preview

```sh
npm install
npm run dev
```
