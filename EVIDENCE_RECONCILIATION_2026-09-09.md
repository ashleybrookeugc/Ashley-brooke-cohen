# NYFW Evidence Reconciliation — September 9, 2026

## Scope
This pass reconciles the screenshot-derived event datasets already committed to the repository with the current public Events/Castings architecture. It does not claim access to the original screenshot image files when those images are unavailable in the current session.

Evidence datasets reviewed:
- `public/data/events.json`
- `public/data/events-supplement.json`
- `public/data/events-screenshot-batch-2.json`
- `public/data/events-screenshot-batch-3.json`
- `public/data/events-screenshot-batch-4.json`

## Changes made

### 1. Casting-only listing removed from Events at render time
`Indie Fashion NYFW Model Call` is explicitly a model casting call, not a general event listing. The Event tracker now excludes records categorized as `casting`, while the casting is seeded into the public Castings dataset.

### 2. Public Castings seeded from reconciled evidence
Added `public/data/castings.json` with:
- Indie Fashion NYFW Model Call — September 11, 10 AM–12 PM, Bolex Studio, all-black attire, professional headshot/comp card, 11:30 AM line cutoff, and $20 on-site headshot fee if needed. Union status and compensation remain `Not stated`.
- Maybelline Fit Me In-Person Casting Call Experience — September 13, 10 AM–7 PM, Ideal Glass Studios. Verified against Maybelline's official page. Eligibility/application/release language is limited to what the official source states. Union status and compensation remain `Not stated`.

The Castings UI now merges these verified static seeds with future D1-published castings and deduplicates by stable casting ID.

### 3. Duplicate protection added to Events
The tracker previously concatenated five JSON files without deduplicating. It now reconciles event records by `event.id` and occurrence records by `occurrence.id` before rendering. Exact duplicate IDs are shown only once. Conflicting duplicate IDs are logged for review instead of creating duplicate cards.

### 4. Multi-day occurrence rule checked
The reviewed datasets already model multi-day events as one shared event plus dated occurrences. Examples verified structurally:
- Christie’s Devil Wears Prada 2 Exhibition: separate daily occurrences, including the shorter September 10 public window and different September 13 hours.
- CHANEL Coco Mademoiselle: separate occurrences with date-specific hours and the September 14–17 closure omitted from public occurrences.
- Medicube: September 10–12 split into separate cards, including different September 12 hours.
- Haus Labs × Sephora: September 10–12 split into separate cards with date-specific hours.
- Mattiasgollin: September 12 and 13 separate 11 AM–6 PM occurrences.
- Groupie × TOKIO7: September 11–13 separate 11 AM–7 PM occurrences.
- MAIDENS SHOP × Colbo: September 12–14 separate 11 AM–7 PM occurrences.
- ITSJUSTJILI: September 10 launch has 6–8 PM; September 11–13 remain separate occurrences with `UNCLEAR` retail hours rather than inventing times.
- ANKA/Afrikrea: September 11–13 separate 12–7 PM occurrences.
- Walmart Fashion: September 10–20 has one 11 AM–7 PM occurrence per calendar day.
- Fenty 34th Street: September 12 and 13 are separate 10 AM–6 PM occurrences.
- Global Fashion Collective: September 11 and 12 are separate date records with the corresponding show times for each date.
- Snoopy in Style: source-derived dataset uses one occurrence per day across its run.

The tracker therefore continues to render one card per dated occurrence instead of collapsing a multi-day event into a single date-range card.

### 5. Known source conflicts preserved rather than guessed
Existing evidence correctly records several source conflicts. The reconciliation pass preserves those notes instead of flattening them:
- Fenty 34th Street: official Fenty locator identifies Sephora, 112 W 34th St for September 12–13; the conflicting roundup location is not used.
- Afropiano: current venue/calendar evidence supports a 5 PM start; the screenshot-derived roundup's 7–8 PM notation is retained as superseded context.
- Galactamelanin: live listing expands the event beyond the narrower roundup time; the live listing is used with the conflict noted.
- Global Fashion Collective: screenshot promoted a Crescala showroom, but official evidence verifies the runway program; public showroom access is not inferred.
- Carolina Herrera Good Girl Lab: current Eventbrite page reports reserved tickets sold out but explicitly says walk-ins are welcome. This remains a special case requiring RSVP availability to be distinguished from event/walk-in availability.

## Remaining evidence limitations
The original screenshot image files from prior project-chat sessions were not exposed to the current file search. This pass therefore uses the screenshot-derived structured JSON already committed by earlier review as the evidence proxy. Any future reconciliation with the raw screenshots should compare them against these records, not start from scratch.

## Data policy reinforced
- Do not infer missing casting demographics, pay, union status, dates, or requirements.
- One underlying event can have many dated occurrences.
- A distinct session on the same date may remain a separate occurrence when it has separate ticket/access/session timing; otherwise the default is one occurrence per event per date.
- Duplicate evidence should strengthen an existing record, not create another public card.
- Conflicting evidence should be retained and flagged, not silently overwritten.
