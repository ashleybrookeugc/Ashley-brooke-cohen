# Portfolio Video Rubric Policy

Status: **Frozen Phase 2A draft for human approval — revised after Ashley authorship decision**  
Scope: policy decisions only. No Ashley video has been scored, no calibration has begun, and no implementation logic is authorized.

This policy governs a rubric whose purpose is to select evidence for Ashley Brooke Cohen's online business card. Metric-level scores remain separate. Social-performance outcomes remain separate and may not be inferred. “Research basis” identifies what Phase 1 evidence supports; “chosen rule” is a project policy choice where research does not determine one answer.

## 1. Metric weighting

### QUESTION
Should the ten rubric metrics be weighted, and can they be combined into one score?

### RESEARCH BASIS
- Phase 1 found no validated composite for this use case.
- Casting, commercial, communication, credibility, identity, and portfolio-set judgments answer different questions.
- Research does not supply defensible numerical weights for Ashley's portfolio.

### RULE OPTIONS
1. One weighted composite — easy ranking, but invents unsupported exchange rates between unlike dimensions.
2. Equal-weight average — simple, but equal weighting is still an unsupported weighting choice.
3. Unweighted metric vector plus audience-qualified conclusions — preserves specialization and audience differences.

### EDGE-CASE TESTS
- Excellent acting with little commercial value remains strong for casting.
- Excellent product demonstration with little acting value remains strong for brands.
- Technically rough but identity-rich footage can retain identity value while execution remains weaker.
- Polished but redundant work can score well on execution while contributing little to the final portfolio.

### CHOSEN RULE
1. Store and display all ten metric results independently as `0`, `1`, `2`, `3`, or `N/O`, each with evidence and rationale.
2. Do not calculate, store, display, sort by, or imply a universal total, average, percentage, star rating, or rank.
3. For each audience perspective, issue only an evidence-qualified finding: `STRONG EVIDENCE`, `USABLE EVIDENCE`, `LIMITED EVIDENCE`, `COUNTEREVIDENCE`, or `N/O`.
4. A weak audience-specific result may restrict the conclusion for that audience only.
5. Portfolio selection occurs under the portfolio-mix rule, not by summed scores.

### RATIONALE
The website serves multiple real audiences whose definitions of useful evidence are not interchangeable.

### REVISION TRIGGER
Change only if later validation with real target-audience decisions supports stable audience-specific weights.

## 2. N/O handling

### QUESTION
When may an evaluator use `N/O`, and how does it differ from `0`?

### RESEARCH BASIS
- Not every metric applies to every format.
- `0` means the metric applies but the video fails to supply useful evidence or supplies counterevidence.
- Incomplete retrieval is not N/O; it is a hard eligibility failure.

### RULE OPTIONS
1. Force every metric to 0–3 — falsely penalizes specialization.
2. Allow unrestricted N/O — creates an evaluator escape hatch.
3. Allow N/O only under enumerated applicability rules — auditable and narrow.

### EDGE-CASE TESTS
- Acting clip with no commercial proposition: commercial usefulness may be `N/O—FORMAT`.
- Hands-only product footage may be `N/O—FORMAT` for entertainment/casting usefulness if Ashley's performance cannot reasonably be evaluated.
- Portfolio contribution before a sufficiently complete comparison corpus exists: `N/O—CORPUS`.
- Incomplete source retrieval: `ELIGIBILITY: FAIL — RETRIEVAL BUG`, never N/O.

### CHOSEN RULE
`N/O` is permitted only after full-video eligibility passes and only with:
- `N/O—FORMAT`: the video does not attempt or contain the kind of task the metric measures.
- `N/O—CORPUS`: portfolio contribution cannot yet be assessed because the comparison set or coverage matrix is materially incomplete.

The evaluator must name the missing observable in one sentence. Use `0`, not N/O, when the metric applies but the attempt is weak, absent, contradictory, or unsuccessful. Reports must show N/O explicitly rather than omit the metric.

### RATIONALE
N/O prevents false penalties without allowing weak evidence to disappear.

### REVISION TRIGGER
Add a new reason code only after calibration reveals repeated cases that cannot be classified consistently under the existing rules.

## 3. Accessibility policy

### QUESTION
Should missing captions or other access support disqualify an otherwise strong video, affect scores, or be treated as remediable publishing work?

### RESEARCH BASIS
- Phase 1 uses W3C guidance for captioning meaningful prerecorded audio and access to essential visual information.
- Production polish is not a proxy for identity, credibility, or performance.

### RULE OPTIONS
1. Automatic exclusion — strongest enforcement but can discard valuable evidence that is easily remediated.
2. Remediation note only — preserves creative scoring but understates a current usability defect.
3. Execution cap plus publication gate — records the defect without contaminating unrelated metrics.

### EDGE-CASE TESTS
- Missing captions but otherwise strong communication: preserve communication/content scores, cap execution as below, block publication until fixed.
- Silent/music-only video with no essential audio: captions are not required solely because an audio track exists.
- Essential visual information with no equivalent: require visual-description remediation when needed for the final presentation.

### CHOSEN RULE
1. Evaluate creative evidence independently of remediation.
2. If meaningful spoken or non-speech audio is required for comprehension and no accurate equivalent is available, set `ACCESSIBILITY: REMEDIATION REQUIRED—CAPTIONS` and cap execution quality at `2/3`.
3. If essential visual information is inaccessible from the accompanying audio/text context, set `ACCESSIBILITY: REMEDIATION REQUIRED—VISUAL DESCRIPTION`.
4. Accessibility failure is not a retrieval failure if the analyzer has fully recovered the source evidence.
5. A flagged video may remain a curation candidate but may not be approved for public publication until the required support is added and verified.
6. Do not reduce unrelated identity, capability, credibility, distinctiveness, commercial, or casting scores solely because access support is missing.

### RATIONALE
Accessibility is both an execution concern and a publication requirement without erasing unrelated evidence.

### REVISION TRIGGER
Revise if the final player/hosting method, legal requirements, or an accessibility audit establishes stricter requirements.

## 4. Portfolio mix

### QUESTION
How should videos earn limited portfolio space when the site serves several audiences and strong items may be redundant?

### RESEARCH BASIS
- Casting and portfolio guidance favors concise sets of strongest evidence rather than exhaustive archives.
- Portfolio contribution is marginal: a good duplicate may add little, while a less polished item can add unique evidence.
- Audience relevance differs by audience.

### RULE OPTIONS
1. Fixed equal quota by audience — balanced but can force weak examples.
2. Include every individually strong video — creates repetition and weakens scanability.
3. Coverage-first matrix with redundancy limits — optimizes the proof set while exposing real gaps.

### EDGE-CASE TESTS
- Excellent acting, low commercial value can occupy acting/casting coverage.
- Excellent UGC, low acting value can occupy commercial/creator coverage.
- Rough but unusually identity-rich work may earn space if no stronger item proves the same facet.
- Polished but redundant work does not earn primary space merely for polish.

### CHOSEN RULE
Maintain a coverage matrix with six audience columns: Agent/Talent, Casting/Producer, Brand/Marketer, Creative Collaborator, First-Time Audience, Portfolio Editor. Evidence rows are created from observed capabilities and identity facets rather than preset content categories.

A video may enter the primary set only if it is:
1. `BEST-IN-CELL`: strongest currently eligible evidence for at least one audience × evidence cell; or
2. `NEW-COVERAGE`: supplies a material identity facet, capability, credible domain, performance lane, audience, or format not supplied by the current primary set.

Additional constraints:
- The set must include eligible evidence for identity clarity, capability proof, and credibility across the set.
- It must include at least one `STRONG` or `USABLE` finding for Casting/Producer and at least one for Brand/Marketer.
- No evidence cell may contain more than two primary items; a second must differ materially in capability, audience, format, tone, or credible domain.
- Do not fill a quota with a weak item; uncovered cells remain `GAP`.
- Final item count is the smallest set that satisfies the approved coverage matrix.

### RATIONALE
The portfolio is a compact proof set, not a social feed archive.

### REVISION TRIGGER
Revise if target-audience review reveals a missing business decision or usability testing shows the smallest compliant set is still too long.

## 5. Ashley Instagram authorship convention

### QUESTION
How should authorship be treated for content published on Ashley's own Instagram account?

### RESEARCH BASIS
Phase 1 correctly warned against inferring behind-camera authorship from arbitrary finished videos. Ashley has now supplied first-party provenance for her own Instagram corpus: when a post appears on `@ashleybrookecohen`, she is the creator responsible for the post's writing/concept/editing and related construction, even when AI tools assist her.

This is not a scored metric. It is corpus metadata supplied by Ashley.

### CHOSEN RULE
1. **Authorship is not a portfolio metric and receives no score.**
2. For posts originating from Ashley's own Instagram account, default provenance is:
   - concept: Ashley
   - writing/copy: Ashley, with AI assistance allowed without changing authorship
   - editing: Ashley
   - post construction/publishing: Ashley
3. Do not downgrade, mark unknown, or use N/O for these roles merely because the finished video itself cannot prove them.
4. If a specific post explicitly indicates a collaborator, repost, externally produced campaign, supplied script/edit, or other materially shared authorship, record that exception for that item.
5. On-camera performance and claims about lived experience are still evaluated from the actual complete video.
6. This convention applies to Ashley's own-account corpus only; unrelated calibration clips must not inherit it.

### RATIONALE
Ashley is the first-party source for provenance of her own account. AI assistance is a tool used within her authorship, not a separate author for portfolio purposes.

### REVISION TRIGGER
Revise only if Ashley identifies classes of posts on her account that systematically have different authorship or production ownership.

## 6. Evaluator calibration

### QUESTION
What must happen before evaluators may score Ashley's videos, and what level of agreement is sufficient to freeze operational anchors?

### RESEARCH BASIS
- Phase 1 identifies untested reliability as a major limitation.
- The research specification requires independent perspective review followed by evidence-based reconciliation.
- Different audience roles are allowed to disagree; agreement is tested within the same metric/perspective instruction.

### RULE OPTIONS
1. One practice clip and discussion — too weak to expose format-specific ambiguity.
2. Large formal validation before any use — stronger but disproportionate for this editorial tool.
3. Bounded blind calibration with explicit initial thresholds and human review — practical and auditable.

### EDGE-CASE TESTS
The calibration set must include, without telling evaluators the intended lesson:
- two acting/performance-led clips with little commercial relevance;
- two UGC/product-led clips with little acting evidence;
- two technically rough but identity/distinctiveness-rich clips;
- two polished but substantially redundant clips evaluated as a mini-corpus;
- one missing-caption clip with otherwise clear communication;
- two clips containing at least one genuine N/O case.

A clip may satisfy more than one condition, but use at least 12 distinct unrelated clips. No Ashley clip may be used for calibration.

### CHOSEN RULE
1. Before Ashley scoring, assemble 12–16 unrelated, fully retrievable clips meeting the edge cases above and freeze the set.
2. Give evaluators the same rubric, policy, complete source evidence, and metadata. Hide popularity metrics, creator identity where practical, and all other evaluators' answers.
3. Each evaluator independently records score/N/O, timestamped or frame-specific evidence, one-sentence anchor rationale, and audience perspective.
4. The Evidence Auditor rejects any result lacking specific evidence, using an invalid N/O code, inferring unavailable performance outcomes, or contradicting the complete source.
5. Version 1 operating thresholds: exact score agreement at least 75%; all remaining valid score pairs differ by no more than one point; N/O versus numeric agreement at least 90%.
6. Do not average disagreements. Reconcile them by matching cited evidence to written anchors; preserve a minority note when two scores remain supportable.
7. If a metric fails, revise only that metric's definition, anchor, or applicability rule and test it on at least six replacement clips not used to create the revision.
8. Do not score Ashley's corpus until all ten metrics pass calibration and the calibrated anchors receive human approval.

### RATIONALE
This creates a meaningful pre-use reliability gate without pretending the initial thresholds are scientifically validated constants.

### REVISION TRIGGER
Change thresholds only if blind calibration or later human validation shows they systematically reject defensible scoring variation. Never lower them merely to make a model pass.

## Frozen policy summary

| Area | Frozen Phase 2A choice |
|---|---|
| Metric weighting | No universal composite; preserve metric vectors and audience-qualified findings. |
| N/O handling | N/O is distinct from 0 and limited to `FORMAT` or `CORPUS`; retrieval failure is never N/O. |
| Accessibility | Missing required support can cap execution and blocks publication until remediated without erasing unrelated evidence. |
| Portfolio mix | Coverage-first audience × evidence matrix; best-in-cell/new-coverage admission; gaps remain visible. |
| Ashley Instagram authorship | Not a metric. Ashley is default author/creator/editor of her own-account posts, with item-specific collaboration exceptions. |
| Evaluator calibration | 12–16 unrelated blind clips, evidence-bound independent ratings, Version 1 agreement thresholds, no averaging, metric-specific retest on failure. |

Human approval is required before calibration or implementation begins.