# Project-wide instructions for agents and coding sessions

These instructions apply to all work in this repository, including portfolio, NYC Pop-Up Radar, Cloudflare Worker, deployment, admin/moderation, and supporting pages.

## Ashley AI second brain — mandatory cross-project read

`ashleybrookeugc/research-vault` is Ashley's canonical durable knowledge layer across projects. Before work that depends on prior research, creator preferences/rules, video analysis, portfolio evaluation methods, UX/filmmaking/UGC research, reusable systems, founder decisions, or cross-project history, consult the vault's `AGENTS.md`, `PROJECT_INDEX.md`, and relevant canonical topic artifact.

This repository remains canonical for **website implementation state**: code, deployment, Worker behavior, tests, portfolio/event UI, and product-specific architecture.

When website/portfolio work produces durable research, evidence, a reusable method, or a decision useful beyond this codebase, update the research vault in the same task. Then ripple the website-specific implementation consequence back here. Prefer pointers to the vault over maintaining divergent research copies. Follow the vault's `SYNC_PROTOCOL.md`.

## Mandatory first read for website work

Before changing deployment, Cloudflare configuration, Worker routing, build/export behavior, authentication, event-site architecture, portfolio architecture, or asset handling, read:

- `docs/TROUBLESHOOTING_LOG.md`

Treat that file as the durable record of previously encountered loops, failed approaches, root causes, verified fixes, and prevention rules. Do not repeat a failed troubleshooting path that is already documented there.

## Stop-loss rule

If the same class of fix fails twice, stop repeating it. Re-check repository state, deployed state, and `docs/TROUBLESHOOTING_LOG.md` before trying a different approach.

## Deployment rule

The normal production path is GitHub `main` → Cloudflare Workers Builds → production. Do not instruct the user to manually deploy, promote, create a second repo, add paid Cloudflare infrastructure, or create a second deployment path unless the existing path has been verified to be broken.

## Scope separation

The Ashley Brooke Cohen portfolio and the NYC Pop-Up Radar share a repository/domain but are separate products. Preserve their separate visual systems and product goals. Portfolio styling should remain scoped to portfolio pages; do not globally restyle the event utility while working on the portfolio.

## Authentic media rule

Production stills, headshots, film/TV/commercial screenshots, and other evidentiary portfolio media must remain authentic by default. Cropping, resizing, compression, and deterministic presentation changes are fine. Do not use generative edits unless Ashley explicitly asks for a creative alteration.

## Source-of-truth rule

For durable research, creator preferences/rules, shared analysis methods, reusable evidence standards, and cross-project decisions, the canonical source is `ashleybrookeugc/research-vault`.

For current website implementation and deployment state, this repository is canonical.

For portfolio work, consult the relevant vault research/preferences source before reopening settled architecture, hero, voice, visual, or video-evaluation decisions. Do not replace previously agreed direction with generic portfolio conventions unless Ashley explicitly asks to revisit it.

## Update the log

Whenever a new recurring failure or confusing loop is actually solved, add an entry to `docs/TROUBLESHOOTING_LOG.md` with:

**Symptom → failed/looping attempts → root cause → verified fix → prevention rule**
