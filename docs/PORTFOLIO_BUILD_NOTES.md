# Portfolio Build Notes

This file tracks the current portfolio implementation state separately from the NYC Pop-Up Radar.

## Current direction

- Ashley-first editorial digital calling card, not a conventional actor-template site.
- Homepage identity image should reflect Ashley's current/natural appearance.
- Alternate styled looks belong deeper in the portfolio as range.
- Visual system: warm ivory, charcoal, ink navy, deep plum/prune, forest/emerald.
- Portfolio styling remains isolated from the event utility.
- Selected proof first; exhaustive archive later.
- Acting clips/stills do not imply the visible examples are the complete booking history.
- Creator work and commercial UGC are related but not identical; personal creator voice remains visible.
- Theatre social/producing belongs in the overlap between performance, production, and creator work.
- No generic 'storyteller / bring ideas to life / connect with audiences' filler language.

## Pages in the working portfolio branch

- `/` — Ashley-first homepage
- `/acting/` — selected on-camera work + clips + selected credits
- `/performances/` — stand-up + theatre
- `/creator/` — personal creator voice + UGC/brand work
- `/projects/` — producing, theatre social, Another Hollywood, NYC Pop-Up Radar, writing
- `/about/` — multi-hyphenate framing without forcing a fake linear career
- `/notes/` — future longer-form writing without placeholder filler
- `/contact/` — acting, creator, collaboration, and separate event-submission routes

## Launch gate

Do not merge a portfolio branch to production until:

1. Every referenced portrait/still asset resolves successfully.
2. Acting still labels are verified.
3. Mobile and desktop layouts are checked.
4. Existing `/nyfw-pop-ups/`, submission, admin/moderation, and event-detail routes remain unchanged.
5. The portfolio branch is current with `main` or is rebuilt from current `main` before merge.
6. Cloudflare build is checked from the first error line if anything fails.
