# Pop-Up Radar — Founder Product Backlog

**status:** active backlog / founder decisions  
**updated:** 2026-09-13  
**scope:** NYC Pop-Up Radar and planned casting-discovery extension  

This file preserves product requirements that emerged from Ashley's live-site review. It is a backlog, not a claim that every item is implemented. Verify current code before choosing a pass.

## Operating rule

Implement in bounded passes. Do not turn a small cleanup task into a routing/storage/scraping architecture overhaul. Preserve the proven GitHub `main` → Cloudflare Workers Builds production path and regression-test changed behavior.

## Public submissions

- Add a prominent submission action for events people see on Instagram, TikTok, flyers, websites, etc.
- Screenshot/source image is required so there is evidence even when a social URL is unavailable or broken.
- Source URL is optional.
- Capture source platform/account/handle when available or extractable.
- Support Event and Casting submission types.
- User submissions must not become verified/public solely because they were submitted.

Likely future Cloudflare-native storage may include R2 for uploaded screenshots and D1 for submission/source/verification state, but this is not locked implementation architecture. Inspect current code and choose the smallest architecture that satisfies the active pass.

## Automated discovery and reverification

Goal: reduce dependence on Ashley manually finding/entering listings.

- Discover candidates from official brand/event pages and other useful public sources.
- Instagram/TikTok are important because many activations are announced there, but first determine what can actually be accessed reliably and appropriately. Do not fake social scraping.
- Screenshot submission is the fallback ingestion path when direct automated access is unavailable.
- Candidate pipeline should eventually extract structured fields, identify source, deduplicate, cross-check sources, retain evidence, detect changed information/conflicts, update verification timestamps, and periodically recheck approaching listings.
- A scraper finding a listing does not itself make the listing verified.
- Do not silently overwrite conflicting evidence.

### Founder decision — moderation source-check semantics

The private moderation workflow should support both a per-submission source check and a queue-wide source check. An automated fetch result is **not** equivalent to a judgment that the listing is valid or invalid.

Required result categories:
- **automatically verified/reachable** — the verifier successfully retrieves the source;
- **manual verification required** — the source may be valid but blocks/challenges automated access, especially Instagram, TikTok, Facebook, Eventbrite or similar bot-protected sources;
- **unavailable/removed** — evidence such as HTTP 404/410 supports that the source is gone;
- **temporarily unavailable** — timeout/5xx/network failure is inconclusive and must not be treated as proof that the listing disappeared;
- **flagged** — the source loads but contains material signals such as cancellation, sold out, waitlist or closed-registration language.

Queue summaries must keep these categories separate rather than collapsing bot-blocked/manual-review cases into `failed`.

Observed implementation state as of 2026-09-13: the moderation page has per-card source verification plus a queue-wide check, and the Worker returns distinct verification-status fields. This is an implementation-state pointer, not proof that every external platform can be verified automatically; live behavior must still be checked.

### Founder decision — hourly website-updating discovery pass

Ashley explicitly chose an hourly discovery loop whose output is the website itself, not merely an alert stream.

Required behavior:
- every hour, search relevant NYC event sources for newly posted or newly verified events;
- verify actionable public access, date, time, location, and the real RSVP/ticket/application path before publication;
- distinguish approval-required, guest-list, first-come, paid, waitlist, sold-out, closed, and unclear access states rather than flattening them into generic RSVP language;
- compare candidates against current site data and suppress duplicates;
- preserve one dated occurrence per event date, with that date's corresponding hours/status;
- correct stale or bad existing information when stronger current evidence is available;
- write verified changes into the GitHub data/source that powers the site and commit them to `main`;
- do not publish unsupported or unresolved claims as verified facts.

Observed implementation state as of 2026-09-13: `public/assets/hourly-feed.js` loads screenshot batches 5–6 plus a growing sequence of hourly JSON feeds, reconciles by ID, performs a semantic duplicate suppression pass across date/brand/address/name/source signals, and keeps the newer verification when duplicate candidates conflict. This is an implementation-state pointer, not a requirement to preserve the current file-count strategy forever.

## RSVP / admission semantics

Ashley explicitly does **not** want RSVP-required events hidden merely because a direct RSVP link could not be found.

For every RSVP-required event:
1. make every reasonable effort to locate and verify the actual direct RSVP/registration/application link;
2. prefer the direct link when verified;
3. never invent/guess a registration URL;
4. if no direct link is verified, keep the listing visible and clearly state that only the main source is available and the visitor should check it for registration.

Required fallback semantics:
- `RSVP REQUIRED`
- `Direct RSVP link not found`
- `Check main source for registration`

A main-source link must not masquerade as a direct RSVP link. Keep RSVP requirement, direct-link actionability, and availability/sold-out/waitlist/closed state distinct.

### Founder decision — consumer-facing admission taxonomy

Do not treat every registration mechanism as equivalent. The public UI should express the practical access state a visitor needs to understand.

Current required taxonomy:
- `WALK-IN` / open public access;
- `FREE RSVP` when registration is free and no organizer-selection step is established;
- `PAID TICKET`;
- `APPROVAL REQUIRED` when the visitor applies/requests access and the host decides;
- `WAITLIST`;
- `INVITE ONLY` when source evidence establishes restricted invitation-only access;
- `FREE GUEST LIST` where sign-up is available but timing, door discretion, priority-entry rules, or explicit non-guarantee language materially affects admission;
- `FIRST-COME · RSVP OPTIONAL` where RSVP exists but does not guarantee or control public access;
- `SOLD OUT` / `CLOSED` when the relevant occurrence is no longer actionable;
- `ACCESS UNCLEAR` when the source does not positively establish the admission path.

Evidence discipline:
- missing RSVP language is **not** proof that an event is walk-in/open;
- organizer approval is materially different from an ordinary free RSVP and must not be hidden under a generic `RSVP REQUIRED` badge;
- ordinary RSVP confirmation should not be described as "guaranteed access" because normal capacity/venue conditions may still apply;
- when public-event evidence and reservation/ticket availability conflict, preserve the conflict rather than collapsing the whole event into one unsupported status.

## Event search / rediscovery

Ashley identified a concrete browse failure: a user may remember only the thing they want (for example "the free ice cream pop-up") or a brand, not the event's exact title. Category filters such as Food/Drink are not sufficient for rediscovery.

Founder requirement: provide real keyword search across the reconciled event set, including scheduler-added events.

Search should match at minimum:
- event name;
- brand;
- neighborhood / venue / address;
- what the event is;
- freebies, samples, food/drink or other benefits;
- practical notes / caveats where those words help rediscovery;
- categories/classifications.

Observed implementation state as of 2026-09-13: `public/assets/event-search.js` wraps the shared event matching function and searches the reconciled event object, so hourly-discovered records become searchable automatically rather than requiring a separate search index.

## Event cards and dedicated pages

- Browse cards should be simple.
- Clicking essentially anywhere on a card should open a dedicated event/occurrence page rather than requiring inline `Sources + details` expansion.
- Detail pages should contain complete event information, RSVP state/action, caveats, verification and source evidence.

## Multi-day events / occurrences

- Do not compress several days with different hours into one confusing browse card.
- Underlying Event and dated Occurrence are separate concepts.
- One browse card per occurrence/day with that day's exact time/status/details.
- Event/occurrence detail experience should link to the other dates for the same underlying event.

Current README documents that the implementation now has shared `events`, dated `occurrences`, and stable occurrence routes. Treat that repository state as canonical and regression-test before further changes.

## Date and view modes

Preserve useful shortcuts such as Today / Tomorrow / This Week and add exact-date selection.

Planned browse modes:
- card/list
- calendar
- map

All views should share the same underlying filters/data state rather than becoming independent data implementations. Map markers should lead to the corresponding event/occurrence detail.

## Subway presentation

Use accessible NYC subway-style bullets rather than plain train letters:
- A/C/E blue
- B/D/F/M orange
- G light green
- J/Z brown
- L gray
- N/Q/R/W yellow
- 1/2/3 red
- 4/5/6 green
- 7 purple
- S gray

Keep the letter/number inside the circle so color is not the sole information channel.

## Castings

Add castings as a distinct discovery/submission type rather than treating them as ordinary pop-up events. Provide a clear Events/Castings distinction.

Capture only when explicitly stated by the source:
- project/title
- casting office/company/source
- role/type
- union/non-union
- rate/pay
- application deadline
- shoot/work dates
- audition/interview dates
- location
- virtual vs in-person
- how to apply
- application URL/email
- height requirements
- clothing/size requirements
- age range
- skills/props/wardrobe requirements
- other stated requirements
- source
- verification status / last verified

Never infer physical or demographic requirements not stated in the notice.

## Remove subjective creator scoring

Remove `Worth filming`, `Creator use`, filming score/rating or equivalent subjective judgments from the public product. Preserve objective facts such as samples, photo booth, makeup touch-ups, food/drink, gifts, networking and activation type.

## Footer / legal / accessibility

- Use a normal minimal footer, not a large disclaimer/developer block.
- Remove public implementation copy such as `Listings are driven by one editable JSON file`.
- Real working pages: Privacy, Terms, Accessibility, Contact.
- Pages should contain accurate substantive information, not compliance buzzwords/placeholders.
- A visually secondary disclaimer such as `Event details can change. Verify with the official source before traveling.` is acceptable.
- Accessibility must exist in implementation: keyboard navigation, visible focus, semantic structure, labels, adequate contrast, meaningful links, text alternatives where applicable.
- Do not claim WCAG conformance without an actual verified audit.

## Analytics

Ashley wants privacy-minimizing Cloudflare Web Analytics for basic traffic measurement. Privacy disclosures must describe what the site actually uses; do not claim analytics/cookies/data practices that have not been verified in the implementation.

## Implementation tiers / sequencing decision

Ashley chose staged implementation because Work usage is limited and the features have different dependency depth.

A bounded Light cleanup pass was defined around:
- RSVP cleanup/link semantics
- subway bullets
- removing subjective creator scoring
- footer cleanup
- real Privacy/Terms/Accessibility/Contact pages
- straightforward accessibility fixes

Dedicated event pages/routing were treated as a later Medium-level task. Calendar/map/date-model work and submission/ingestion/scraping/casting infrastructure should remain separate passes unless Ashley explicitly changes scope.

Before starting any pass, inspect current implementation because some backlog items may already have been implemented since this decision was recorded.
