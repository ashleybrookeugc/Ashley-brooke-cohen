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
- Creator positioning should prefer one coherent audience/value relationship over a comma-separated inventory of niches when the page/form asks what Ashley makes and who it is for.
- Preserve Ashley's existing differentiators — acting, stand-up comedy, NYC life, genuine first impressions/discovery — while allowing the creator story to show an adjacent growth direction into fashion, wellness, lifestyle, and body-specific clothing-fit discovery.
- When explaining why Ashley wants a specific management/representation partner, use real fit she noticed in that organization's representation/content direction when verified; avoid generic "help me grow/get brand deals" reasoning.
- **Shortest route wins:** route brands/agencies, casting/reps/production, comedy bookers/fans and general followers to the relevant work without forcing everyone through a long biography.
- Creator process direction must preserve the real sequence: try the product first, identify what is genuinely interesting about the experience, then develop the premise/story and make the piece. Do not imply permanent life integration before Ashley has actually tried something.
- Do not design the portfolio around an intro video; Ashley does not want one now.

## Canonical portfolio / website direction

The durable non-NYFW website research and founder preferences now live in the second brain:

- `ashleybrookeugc/research-vault/research/ashley-website/2026-09-13-portfolio-website-direction.md`

Use that file before reopening settled hero, routing, creator-positioning, proof/metrics, reference-site or information-hierarchy decisions. This file remains implementation-oriented and should not duplicate the full research narrative.

## Canonical positioning evidence

The durable evidence and caveats behind the creator-positioning bullets live in the second brain rather than being duplicated here:

- `ashleybrookeugc/research-vault/evidence/creator-workflows/2026-09-13-creator-positioning-specificity-and-audience-fit.md`
- `ashleybrookeugc/research-vault/evidence/creator-workflows/2026-09-13-management-application-and-content-direction.md`

These are positioning/context inputs, not instructions to rewrite the live site before Ashley explicitly chooses the copy and proof to publish.

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