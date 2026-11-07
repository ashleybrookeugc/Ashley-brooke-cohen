# Rep Atlas — actor representation intelligence MVP

Original static HTML/CSS/JavaScript prototype. Lives under `apps/rep-atlas/index.html` on this isolated development branch. It is **not live or merged**. Open the HTML locally or use a static web server; avoid adding this route to public production until its privacy model and ownership are approved.

## Built and tested
- Agency search, 5 source-backed NY starter dossiers, research checklist and citations, profile, configurable fit scores, pipeline, editable pitch composer.
- Policy gating distinguishes official email, official form, unknown submissions, and explicitly closed unsolicited submissions.
- Import/export of user data through local JSON; agency CSV export.
- Desktop/mobile in-memory Chromium smoke test: overview, discovery, dossier, research, evidence, outreach status, edit, profile, composer all rendered without page errors.
- Node JavaScript syntax check PASS.

## Not yet built
- Autonomous live research/roster verification, real Gmail OAuth/automatic sending, calendar/sync, real-time data freshness.
- No sending or backend; browser localStorage only; check agency policy again before outreach.
- Do not assume these five records are deeply researched. Ratings are illustrative subjective hypotheses.

## Initial public sources (as of 2026-10-15)
DDO: https://www.ddoagency.com/newyork
Avalon: https://avalonartists.com/submissions/
Take 3: https://take3talent.com/submissions/
CESD: https://cesdtalent.com/
Buchwald: https://www.buchwald.com/
Union reference: https://www.sagaftra.org/contracts-industry-resources/agents-managers/about-professional-representatives/franchised-agents-list

## Workflow
Research and cite → verify submission permission → build real actor positioning → review a single customized draft → manually send through a mail client or official form → record concrete outcomes. No proprietary competitor data has been copied.
