# Portfolio Video Rubric Policy

Status: **Frozen Phase 2A draft for human approval**  
Scope: policy decisions only. No Ashley video has been scored, no calibration has begun, and no implementation logic is authorized.

This policy governs a rubric whose purpose is to select evidence for Ashley Brooke Cohen's online business card. Metric-level scores remain separate. Social-performance outcomes remain separate and may not be inferred. “Research basis” identifies what the Phase 1 evidence supports; “chosen rule” is a project policy choice where the research does not determine one answer.

## 1. Metric weighting

### QUESTION

Should the ten rubric metrics be weighted, and can they be combined into one score?

### RESEARCH BASIS

- **Evidence:** The Phase 1 research found no validated composite for this use case. The dimensions combine communication, persuasion, casting, commercial, and portfolio-set judgments; their relative validity and weights are unknown. ([Rubric research: known limitations](./PORTFOLIO_VIDEO_RUBRIC_RESEARCH.md#known-limitations-and-unresolved-questions))
- **Evidence:** Work samples can predict relevant performance, but the cited meta-analysis found useful rather than definitive validity; a video cannot prove every future capability. ([Rubric research: capability proof](./PORTFOLIO_VIDEO_RUBRIC_RESEARCH.md#2-capability-proof); source 4)
- **Evidence:** Casting sources prioritize performance choices and screen evidence, while advertiser research prioritizes creator/audience fit and commercial outcomes. These are different decisions, not interchangeable measures. ([Rubric research: audience relevance](./PORTFOLIO_VIDEO_RUBRIC_RESEARCH.md#5-audience-relevance); [commercial usefulness](./PORTFOLIO_VIDEO_RUBRIC_RESEARCH.md#9-commercial-usefulness); sources 2, 3, 5, 6, 21)
- **Policy choice:** Whether to weight or aggregate is a governance decision. The research does not supply defensible numerical weights for Ashley's portfolio.

### RULE OPTIONS

1. **One weighted composite.** Strength: easy ranking. Risks: invents unsupported weights, hides audience disagreement, and lets low commercial utility invalidate a strong acting clip or vice versa.
2. **Equal-weight average.** Strength: simple and superficially neutral. Risks: equal weighting is still a weighting decision; N/O handling distorts denominators; unrelated strengths and weaknesses cancel each other.
3. **Unweighted metric vector plus audience-qualified conclusions.** Strengths: preserves evidence, audience differences, and genuine specialization. Risks: requires a later selection process and does not produce a convenient leaderboard.

### EDGE-CASE TESTS

- Excellent acting with little commercial value: remains strong for casting; low commercial usefulness does not cancel it.
- Excellent product demonstration with little acting value: remains strong for brands; low casting usefulness does not cancel it.
- Technically rough but identity-rich: identity evidence remains visible beside the execution limitation.
- Polished but redundant: execution quality remains high while portfolio contribution can be 0.
- Genuinely unobservable metric: N/O remains visible and cannot be converted to a favorable or unfavorable number.

### CHOSEN RULE

1. Store and display all ten metric results independently as `0`, `1`, `2`, `3`, or `N/O`, each with evidence and a rationale.
2. Do not calculate, store, display, sort by, or imply a total, average, percentage, star rating, or universal rank.
3. For every audience perspective, issue only an evidence-qualified finding: `STRONG EVIDENCE`, `USABLE EVIDENCE`, `LIMITED EVIDENCE`, `COUNTEREVIDENCE`, or `N/O`. The finding must cite the relevant metric results and cannot arithmetically combine them.
4. A low audience-specific metric may restrict the conclusion for that audience only. It cannot invalidate the video for another audience.
5. Portfolio selection occurs under the portfolio-mix rule below, not by summed scores.

### RATIONALE

This is the only option that preserves metric-level evidence and the site's multiple business audiences without pretending that casting value and commercial value share a known exchange rate.

### REVISION TRIGGER

Change this rule only if a later validation study uses real target-audience decisions, a preregistered outcome, and enough examples to estimate stable, audience-specific weights. Convenience, model preference, or correlation with views is insufficient.

## 2. N/O handling

### QUESTION

When may an evaluator use `N/O`, and how does it differ from a score of `0`?

### RESEARCH BASIS

- **Evidence:** Phase 1 states that product demonstration, narrative payoff, disclosure, casting range, and other evidence are not equally applicable to every format. It expressly separates “not observable” from zero. ([Rubric research: draft anchors](./PORTFOLIO_VIDEO_RUBRIC_RESEARCH.md#draft-observable-scoring-anchors); [limitations 4 and 11](./PORTFOLIO_VIDEO_RUBRIC_RESEARCH.md#known-limitations-and-unresolved-questions))
- **Evidence:** A zero anchor means absence or counterevidence in an applicable dimension; it is not a placeholder for missing access, incomplete retrieval, or unknown authorship.
- **Policy choice:** The allowed reason codes and effect of N/O are project rules; research does not prescribe them.

### RULE OPTIONS

1. **Force every metric to 0–3.** Strength: complete matrix. Risks: falsely penalizes specialization and converts missing knowledge into negative evidence.
2. **Allow unrestricted N/O.** Strength: avoids forced claims. Risks: evaluators can evade difficult scores or inflate profiles by removing weak dimensions.
3. **Allow N/O only under enumerated reason codes.** Strengths: distinguishes inapplicability from weakness while remaining auditable. Risk: requires explicit applicability checks.

### EDGE-CASE TESTS

- Acting clip with no product/proposition: commercial usefulness may be `N/O—FORMAT` if no commercial task is attempted; it is not automatically 0.
- Product demonstration with no character/performance task: entertainment/casting usefulness is still observable if Ashley presents on camera; use 0–3. Use `N/O—FORMAT` only when Ashley's performance cannot reasonably be evaluated, such as hands-only product footage.
- Video where writing/editing authorship is unknown: authorship is `UNKNOWN`; the visible execution can still be scored, but it cannot become proof that Ashley wrote or edited it.
- Metric genuinely cannot be observed: use a permitted N/O code with a factual explanation.
- Retrieval is incomplete: the entire video is ineligible under the research specification; do not use N/O to rescue it.

### CHOSEN RULE

`N/O` is permitted only after full-video eligibility passes and only with one of these codes:

- `N/O—FORMAT`: the video does not attempt or contain the kind of task the metric measures.
- `N/O—ATTRIBUTION`: the metric would require crediting Ashley for an unconfirmed production role.
- `N/O—CORPUS`: portfolio contribution cannot yet be assessed because the comparison set or coverage matrix is absent or materially incomplete.

The evaluator must add one sentence naming the missing observable. Use `0`, not N/O, when the metric applies but the video supplies no evidence, contradicts the claimed evidence, or performs the task unsuccessfully. N/O is excluded from all arithmetic; because no aggregate is permitted, it cannot change a denominator. Reports must show it rather than omit the metric. Incomplete retrieval remains `ELIGIBILITY: FAIL — RETRIEVAL BUG`, not N/O.

### RATIONALE

Enumerated codes prevent N/O from becoming either a hidden penalty or a loophole. The rule preserves specialized evidence while requiring the evaluator to distinguish “not attempted,” “unknown,” and “poorly done.”

### REVISION TRIGGER

Add or change a reason code only after calibration produces at least three materially different cases that cannot be classified consistently under the existing codes. Never add a code merely to avoid a low score.

## 3. Accessibility policy

### QUESTION

Should missing captions or other access support disqualify an otherwise strong video, affect its rubric scores, or be treated as remediable publishing work?

### RESEARCH BASIS

- **Evidence:** W3C guidance says prerecorded synchronized media with meaningful audio needs captions and that essential visual information may require description or an equivalent. ([Rubric research: execution quality](./PORTFOLIO_VIDEO_RUBRIC_RESEARCH.md#7-execution-quality); sources 24 and 25)
- **Evidence:** The execution-quality construct asks whether meaning and performance can be perceived; platform guidance also values readable text, clear audio, vertical presentation, and safe-zone placement. (Sources 13 and 23)
- **Evidence:** Production polish is not a proxy for identity, credibility, or performance. Missing access support therefore should not erase evidence in unrelated metrics.
- **Policy choice:** W3C supplies the standard; whether a missing caption is a curation exclusion, score cap, or remediation gate is a portfolio policy decision.

### RULE OPTIONS

1. **Automatic curation exclusion.** Strength: strongest enforcement. Risks: discards valuable identity/casting evidence even when captions can be added before publication.
2. **No scoring effect; remediation note only.** Strength: preserves creative evaluation. Risks: understates a real communication defect and may allow inaccessible publication.
3. **Execution cap plus publish gate.** Strengths: records the current defect without contaminating unrelated metrics and requires correction before public use. Risk: requires a remediation workflow later.

### EDGE-CASE TESTS

- Missing captions but otherwise strong communication: communication effectiveness is scored from the content as retrieved; execution quality cannot exceed 2/3 when meaningful speech/audio lacks an accurate equivalent; publication is blocked until captions exist.
- Technically rough personality-rich clip: identity/distinctiveness may still score highly; execution records only the actual barriers.
- Silent or music-only clip with no essential audio: captions are not required solely because the file contains an audio track; state why audio is nonessential.
- Essential visual-only information with no equivalent: mark visual-description remediation when that information is needed to understand the selected portfolio presentation.

### CHOSEN RULE

1. Evaluate creative evidence before remediation and preserve every metric independently.
2. If meaningful spoken or non-speech audio is required to understand the video and no accurate caption/equivalent is available, set `ACCESSIBILITY: REMEDIATION REQUIRED—CAPTIONS` and cap execution quality at `2/3`.
3. If essential visual information cannot be understood from the audio/caption context, set `ACCESSIBILITY: REMEDIATION REQUIRED—VISUAL DESCRIPTION`. Do not impose an automatic numerical cap until the eventual presentation method is known; the remediation flag is mandatory.
4. Accessibility failure is not a full-retrieval failure when the analyzer itself has recovered the audio/visual evidence.
5. A flagged video may remain a curation candidate but may not be approved for public portfolio publication until the required support is added and verified against the complete video.
6. Do not reduce identity, capability, credibility, distinctiveness, commercial, or casting scores solely because captions/descriptions are missing; reduce them only if the underlying content itself fails their anchors.

### RATIONALE

The rule treats accessibility as both observable execution quality and a non-negotiable publication requirement while avoiding the false conclusion that missing captions erase Ashley's performance or point of view.

### REVISION TRIGGER

Change the execution cap or required supports if the intended portfolio player, hosting method, legal requirements, or a formal accessibility audit establishes a stricter standard. Never weaken the publication gate because remediation is inconvenient.

## 4. Portfolio mix

### QUESTION

How should videos earn limited portfolio space when the site serves several audiences and strong items may be redundant?

### RESEARCH BASIS

- **Evidence:** Casting guidance favors concise reels, strongest performances, focal visibility, contrasting material where useful, and not including every project. ([Rubric research: portfolio contribution](./PORTFOLIO_VIDEO_RUBRIC_RESEARCH.md#8-portfolio-contribution); sources 6 and 20)
- **Evidence:** Portfolio contribution is marginal: a good duplicate can add little, while a somewhat rougher item may add unique evidence. ([Rubric research: portfolio contribution](./PORTFOLIO_VIDEO_RUBRIC_RESEARCH.md#8-portfolio-contribution))
- **Evidence:** Audience relevance is dyadic. The same video can be highly relevant to one target audience and low-value to another. ([Rubric research: audience relevance](./PORTFOLIO_VIDEO_RUBRIC_RESEARCH.md#5-audience-relevance))
- **Policy choice:** Research supports curation and coverage, but it does not determine Ashley's final number of clips or exact audience quotas.

### RULE OPTIONS

1. **Fixed equal quota by audience.** Strength: visible balance. Risks: forces weak examples, ignores overlap, and treats all business priorities as equal.
2. **Take every individually strong video.** Strength: simple. Risks: creates repetition, hides range, and makes the online business card harder to scan.
3. **Coverage-first matrix with redundancy limits.** Strengths: optimizes the set's evidence while preserving specialized work. Risks: requires explicit lane definitions and corpus comparison.

### EDGE-CASE TESTS

- Excellent acting, low commercial value: eligible as acting/casting coverage; it need not cover brands.
- Excellent UGC, low acting value: eligible as creator/commercial coverage; it need not prove dramatic range.
- Rough but unusually identity-rich: may fill identity/POV coverage if execution is still publishable or remediable and no stronger item proves the same facet.
- Polished but contributes nothing new: does not enter the primary set merely for polish.
- Two videos prove the same lane: keep the stronger evidence item; a second earns space only if it differs materially in audience, capability, format, tone, or credible domain.

### CHOSEN RULE

Maintain a coverage matrix with six audience columns (Agent/Talent, Casting/Producer, Brand/Marketer, Creative Collaborator, First-Time Audience, Portfolio Editor) and evidence rows created from observed capabilities/identity facets rather than preset content categories.

A video may enter the **primary portfolio set** only if it meets at least one of these tests:

1. `BEST-IN-CELL`: it is the strongest currently eligible evidence for at least one audience × evidence cell; or
2. `NEW-COVERAGE`: it supplies a material identity facet, capability, credible domain, performance lane, audience, or format not supplied by any current primary item.

Additional constraints:

- The primary set must contain at least one eligible item with `2` or `3` evidence for identity clarity, capability proof, and credibility across the set; these may be different videos.
- The primary set must contain at least one `STRONG` or `USABLE` audience finding for Casting/Producer and at least one for Brand/Marketer. Neither can invalidate the other.
- No evidence cell may contain more than two primary items. The second must document a material difference in capability, audience, format, tone, or credible domain.
- When two items occupy the same cell without a material difference, retain the one with stronger anchor evidence; use execution quality only as the tiebreaker after relevance and evidence strength.
- Do not fill a quota with a weak item. An uncovered cell remains explicitly `GAP`.
- Final item count is the smallest set that satisfies the approved coverage matrix under these rules; no fixed total is imposed in Phase 2A.

### RATIONALE

This makes the portfolio a compact proof set rather than a feed. It protects audience-specific excellence, prevents polish-driven redundancy, and exposes genuine gaps instead of hiding them with quotas.

### REVISION TRIGGER

Revise the matrix or two-item redundancy limit if human target-audience review identifies an important business decision the current rows/columns cannot represent, or if the smallest compliant set is demonstrably too long for first-time visitors in usability testing.

## 5. Authorship attribution

### QUESTION

What may the rubric credit to Ashley when she appears in a video but writing, concept, shooting, directing, or editing authorship is unknown?

### RESEARCH BASIS

- **Evidence:** Phase 1 notes that finished videos rarely reveal production authorship; evaluators should credit only Ashley's observable contribution and mark unknown roles. ([Rubric research: capability proof](./PORTFOLIO_VIDEO_RUBRIC_RESEARCH.md#2-capability-proof); [limitation 4](./PORTFOLIO_VIDEO_RUBRIC_RESEARCH.md#known-limitations-and-unresolved-questions))
- **Evidence:** Work-sample logic supports evaluating behavior actually performed, while casting guidance supports judging Ashley-focal character and on-camera choices. (Sources 4–6)
- **Policy choice:** The attribution fields, acceptable proof, and effect of unknown authorship require a project rule.

### RULE OPTIONS

1. **Credit all apparent craft to the featured creator.** Strength: easy. Risks: false claims and inflated capability evidence.
2. **Credit nothing without formal documentation.** Strength: maximally conservative. Risks: erases directly observable on-camera performance and speech.
3. **Role-by-role provenance with visible-performance exception.** Strengths: credits what is actually observable while preventing inferred behind-camera authorship. Risk: requires structured provenance records.

### EDGE-CASE TESTS

- Ashley appears; writing/editing/shooting unknown: on-camera performance can be evaluated, but writing, editing, cinematography, and direction remain `UNKNOWN` and cannot support those capability claims.
- Ashley visibly demonstrates a product: her presentation and use are observable; concept and script ownership are not.
- Ashley speaks in first person: the delivery and expressed point of view are observable; word-for-word authorship is not automatically confirmed.
- Collaborative post credits Ashley as co-writer: record `CONFIRMED—SHARED` with the source; do not upgrade to primary authorship.

### CHOSEN RULE

Record attribution separately for `on-camera performance`, `spoken personal experience`, `concept`, `writing`, `shooting`, `direction`, and `editing`. Each field must use one value:

- `OBSERVED`: reserved for actions directly visible/audible in the complete video, limited to on-camera performance and the fact that Ashley states an experience or opinion.
- `CONFIRMED—PRIMARY`: supported by Ashley's direct statement, an original post credit, production credit, contract/deliverable record, or equivalent first-party evidence.
- `CONFIRMED—SHARED`: same proof standard, with collaborators credited.
- `UNKNOWN`: no qualifying evidence.
- `N/A`: the role does not exist for the item.

Every confirmed value must store its provenance. Appearance, account ownership, first-person delivery, stylistic consistency, or absence of another credit is never sufficient to infer concept, writing, shooting, direction, or editing. Unknown production authorship does not reduce scores for Ashley's observable on-camera performance, communication, or firsthand claim, but the unknown role cannot support capability proof or distinctiveness claims about that craft.

### RATIONALE

The rule prevents the portfolio from claiming work Ashley may not have done while preserving legitimate evidence of the performance, communication, and experience visible in the asset.

### REVISION TRIGGER

Revise proof categories only if the project gains a reliable first-party production ledger or credit schema that can distinguish roles more precisely. Model inference, visual style, or repeated patterns are not revision evidence.

## 6. Evaluator calibration

### QUESTION

What must happen before evaluators may score Ashley's videos, and what level of agreement is sufficient to freeze operational anchors?

### RESEARCH BASIS

- **Evidence:** Phase 1 identifies untested reliability as a major limitation and recommends unrelated calibration clips, evidence citations, disagreement measurement, anchor revision, and reconciliation rather than averaging. ([Rubric research: limitation 12](./PORTFOLIO_VIDEO_RUBRIC_RESEARCH.md#known-limitations-and-unresolved-questions))
- **Evidence:** The research specification requires independent perspective review followed by evidence-auditor reconciliation against the actual video timeline. ([Research specification: board-room process](./PORTFOLIO_VIDEO_RESEARCH_SPEC.md#board-room-process))
- **Evidence:** Audience standards genuinely differ, so disagreement across different roles is not automatically error. Agreement should be tested within the same metric/perspective instruction, not by forcing all roles to the same conclusion.
- **Policy choice:** Calibration-set composition, minimum evidence, thresholds, and failure response are governance choices; the literature reviewed in Phase 1 does not validate a particular cutoff.

### RULE OPTIONS

1. **One practice clip and discussion.** Strength: fast. Risks: cannot expose format-specific ambiguity or establish reliability.
2. **Large formal validation before any use.** Strength: strongest measurement foundation. Risks: disproportionate to this editorial tool and may indefinitely block useful review.
3. **Bounded blind calibration with explicit pass/fail thresholds and later human validation.** Strengths: auditable, practical, and able to reveal anchor defects before Ashley is judged. Risk: thresholds remain policy choices and the first sample is small.

### EDGE-CASE TESTS

The calibration set must include, without identifying the intended lesson to evaluators:

- two acting/performance-led clips with little commercial relevance;
- two UGC/product-led clips with little acting evidence;
- two technically rough but identity/distinctiveness-rich clips;
- two polished but substantially redundant clips evaluated as a mini-corpus;
- one unknown-authorship clip;
- one missing-caption clip with otherwise clear communication;
- two clips containing at least one genuine N/O case.

A clip may satisfy more than one condition, but the set must contain at least 12 distinct clips. No Ashley clip may be used.

### CHOSEN RULE

1. Before any Ashley scoring, assemble 12–16 unrelated, fully retrievable clips meeting every edge-case condition above. Freeze the set before evaluators see it.
2. Provide the same rubric, policy, complete video evidence, and source metadata to every evaluator. Hide popularity metrics, creator identity where technically practical, and all other evaluators' answers.
3. Each evaluator independently records, for every applicable metric: score/N/O code, timestamped or frame-specific evidence, one-sentence anchor rationale, audience perspective, and attribution limits.
4. An Evidence Auditor rejects any result lacking specific evidence, using an invalid N/O code, inferring authorship/performance outcomes, or contradicting the complete source.
5. For each metric within the same perspective instruction, calibration passes only when: (a) exact score agreement is at least 75%; (b) all remaining valid score pairs differ by no more than one point; and (c) N/O versus numeric agreement is at least 90%. Report denominators and counts, not rounded labels alone.
6. Do not average disagreements. Reconcile each material disagreement by matching cited evidence to the written anchor. Preserve a minority note when two scores remain supportable.
7. If any metric fails a threshold, revise only that metric's definition, anchor, or applicability rule; then test it on at least six replacement clips not used to create the revision. Do not begin Ashley scoring until all ten metrics pass.
8. Passing calibration authorizes a human-review proposal, not automatic implementation. Human approval of this policy and the calibrated anchors is still required.

### RATIONALE

This creates a meaningful stop gate without pretending that a small internal exercise is formal validation. It tests the exact failure modes most likely to distort Ashley's portfolio and treats disagreement as evidence to investigate.

### REVISION TRIGGER

Change the set size or thresholds if qualified human evaluators demonstrate that the current protocol systematically rejects defensible audience-specific variation, or if post-approval reliability on a new blinded sample falls below any threshold. Never lower a threshold merely to pass a favored evaluator or model.

## Frozen policy summary

| Area | Frozen Phase 2A choice |
|---|---|
| Metric weighting | No universal composite or arithmetic weighting; preserve metric vectors and audience-qualified findings. |
| N/O handling | N/O is distinct from 0 and allowed only as `FORMAT`, `ATTRIBUTION`, or `CORPUS`, with a stated missing observable. |
| Accessibility | Missing required access support caps execution at 2/3 where specified and blocks publication, but does not erase unrelated evidence. |
| Portfolio mix | Coverage-first audience × evidence matrix; best-in-cell/new-coverage admission; maximum two materially distinct items per cell; gaps remain visible. |
| Authorship attribution | Role-by-role provenance; visible performance may be observed; behind-camera authorship is never inferred. |
| Evaluator calibration | 12–16 unrelated blind clips, evidence-bound independent ratings, explicit agreement thresholds, no averaging, metric-specific retest on failure. |

Human approval of all six frozen choices is required before calibration or implementation begins.
