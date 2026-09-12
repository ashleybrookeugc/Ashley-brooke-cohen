# Portfolio Video Calibration Protocol

Status: Phase 2B calibration protocol. No Ashley videos may be scored under this protocol until calibration passes and the frozen policy is human-approved.

## Purpose

This protocol tests whether the portfolio-video rubric can be applied consistently enough to support Ashley Brooke Cohen's online-business-card website. It does not validate social performance, virality, or business outcomes. It tests whether independent evaluators can apply the researched rubric and frozen policy to the same complete video evidence without drifting into unsupported inference.

## Governing documents

Evaluators must use, in order:

1. `docs/PORTFOLIO_VIDEO_RESEARCH_SPEC.md`
2. `docs/PORTFOLIO_VIDEO_RUBRIC_RESEARCH.md`
3. `docs/PORTFOLIO_VIDEO_RUBRIC_POLICY.md`
4. This protocol

If this protocol conflicts with a frozen policy rule, the policy controls.

## Calibration set

Target size: **12–16 distinct public short-form videos** from creators other than Ashley.

Every calibration clip must be fully retrievable and must collectively cover these edge cases:

- at least 2 acting/performance-led clips with little commercial relevance;
- at least 2 UGC/product-led clips with little acting evidence;
- at least 2 technically rough but identity/distinctiveness-rich clips;
- at least 2 polished but substantially redundant clips evaluated together as a mini-corpus;
- at least 1 clip with missing captions but otherwise clear communication;
- at least 2 clips containing at least one genuine `N/O—FORMAT` or `N/O—CORPUS` case;
- at least 2 clips where audience perspectives should reasonably diverge.

One clip may satisfy multiple edge conditions, but the set must still contain at least 12 distinct clips.

### Selection rules

- Do not use Ashley clips.
- Do not choose clips because their expected score is already known.
- Use a mix of formats, lengths, polish levels, and content purposes.
- Avoid making the set overwhelmingly brand, acting, comedy, or lifestyle content.
- Freeze the calibration-set manifest before evaluator scoring begins.
- Store only the information needed for evaluation; popularity metrics must not be shown to evaluators.

## Full-retrieval eligibility gate

A clip is eligible only when retrieval confidence is exactly **2/2**.

The Evidence Auditor must verify access to:

- complete video from beginning through end;
- spoken audio or complete transcript;
- on-screen text;
- representative visual frames across the full timeline;
- original caption/post text where available;
- duration;
- original URL;
- public post metadata necessary to identify the source and context.

If any material portion is missing, use:

`ELIGIBILITY: FAIL — RETRIEVAL BUG`

The clip receives no metric scores, no audience findings, and no qualitative portfolio judgment. Replace it with another clip for calibration.

## Blinding procedure

Before scoring:

- hide views, likes, comments, shares, follower counts, virality labels, engagement rates, and other popularity/performance indicators;
- hide all prior AI analyses and all other evaluators' answers;
- hide creator identity where technically practical without damaging the evidence itself;
- do not remove information that is part of the actual creative artifact, such as a spoken self-introduction or visible account watermark that is necessary to understand the clip;
- provide every evaluator the same source package and rubric version.

Each evaluator submits independently before any reconciliation begins.

## Evaluator board

### 1. Evidence Auditor

**Purpose:** Protect the study from incomplete retrieval, invented evidence, unsupported N/O use, and policy violations.

**Allowed to judge:**
- source completeness;
- whether cited timestamps/frames actually support a claim;
- whether N/O is permitted under policy;
- whether an evaluator inferred facts not present in the source;
- whether an answer contradicts the complete video.

**Does not judge:** creative quality, marketability, casting strength, commercial value, or personality.

**Required evidence:** retrieval checklist plus exact timestamps/frames for disputed evaluator claims.

**Must not infer:** creator intent, hidden authorship, future performance, social performance, or off-camera traits.

### 2. First-Time Viewer

**Purpose:** Test whether a person with no prior relationship to the creator can understand and care about what is being presented.

**Primary metrics:** identity clarity, audience relevance, communication effectiveness, credibility where directly observable.

**Required evidence:** opening setup, points of confusion/clarity, progression, payoff, and any claim that establishes or undermines trust.

**Must not infer:** business ROI, casting suitability for unspecified roles, production authorship, or popularity.

**Distinct role:** judges legibility and relevance from a cold-viewer perspective, not professional hiring utility.

### 3. Agent / Talent Evaluator

**Purpose:** Evaluate whether the clip supplies useful evidence for positioning, representation, professional identity, and repeatable strengths.

**Primary metrics:** identity clarity, capability proof, distinctiveness, credibility, audience relevance, entertainment/casting usefulness where applicable.

**Required evidence:** observable lane, repeatable-seeming skill evidence, point of view, camera presence, or professional-domain evidence.

**Must not infer:** booking likelihood, fame potential, follower-driven market value, or off-camera reliability.

**Distinct role:** asks whether the clip helps explain and position the person professionally, not whether it would convert as an ad.

### 4. Casting Director / Producer

**Purpose:** Evaluate usable on-camera/performance evidence for casting or production decisions.

**Primary metrics:** capability proof, communication effectiveness, execution quality, entertainment/casting usefulness, distinctiveness where it affects performance specificity.

**Required evidence:** character/performance choices, timing, listening/reactivity where visible, vocal/facial control, screen focus, and whether technical presentation obscures or supports the performance.

**Must not infer:** set behavior, professionalism beyond the artifact, role fit for an unspecified project, or future booking outcomes.

**Distinct role:** centers playable/performance evidence rather than broad brand identity.

### 5. Brand / Performance Marketer

**Purpose:** Evaluate whether the clip demonstrates transferable creator capability for communicating a brand, product, service, proposition, or experience to an audience.

**Primary metrics:** commercial usefulness, capability proof, credibility, audience relevance, communication effectiveness, execution quality.

**Required evidence:** product/proposition clarity, demonstration or use where relevant, supported benefits, message hierarchy, audience fit, natural integration, and disclosure handling when applicable.

**Must not infer:** conversion rate, ROAS, brand lift, or campaign performance without external data.

**Distinct role:** judges demonstrated commercial communication skill, not general acting merit.

### 6. Creative Collaborator

**Purpose:** Evaluate evidence that the creator brings perspective, ideas, format fluency, and useful creative contribution.

**Primary metrics:** distinctiveness, capability proof, identity clarity, communication effectiveness, credibility where relevant.

**Required evidence:** specific framing choices, point of view, structure, adaptation of format, problem-solving visible in the artifact, and non-generic creative decisions.

**Must not infer:** teamwork, temperament, dependability, or behind-the-scenes behavior that is not observable.

**Distinct role:** focuses on the creative contribution visible in the finished work.

### 7. Short-Form Creative Director

**Purpose:** Evaluate craft and short-form execution without confusing polish with value.

**Primary metrics:** communication effectiveness, execution quality, capability proof, distinctiveness.

**Required evidence:** hook/premise legibility, beat progression, pacing, framing, text readability, audio intelligibility, visual support for the idea, and whether the ending resolves or lands the setup.

**Must not infer:** audience retention or performance metrics that are not supplied.

**Distinct role:** judges how well the creative construction works as short-form media.

### 8. Portfolio Editor

**Purpose:** Evaluate the marginal value of a clip within a set rather than merely whether the clip is good by itself.

**Primary metrics:** portfolio contribution plus the relevant underlying metric evidence from other evaluators.

**Required evidence:** coverage matrix, overlap with other candidate clips, best-in-cell status, new-coverage status, and redundancy comparison.

**Must not infer:** value from polish alone or fill a quota with weak evidence.

**Distinct role:** can prefer a slightly less polished clip if it contributes unique evidence to the set.

### 9. Chair / Cross-Examiner

**Purpose:** Reconcile evidence conflicts after independent scoring without averaging them away.

**Allowed to judge:** whether evaluator claims match the written anchors and source evidence; whether disagreements are true audience differences, anchor ambiguity, or unsupported scoring.

**Required evidence:** exact conflicting scores, cited timestamps/frames, applicable rubric anchor, and reconciliation outcome.

**Must not infer:** a new score merely to split the difference.

**Distinct role:** does not perform a fresh independent review as a tenth scorer. It adjudicates the board's evidence and preserves defensible minority positions.

## Scoring record schema

For each eligible clip, each relevant evaluator records:

- `clip_id`
- `evaluator_role`
- `rubric_version`
- `eligibility = PASS`
- `metric`
- `result = 0 | 1 | 2 | 3 | N/O—FORMAT | N/O—CORPUS`
- `evidence[] = timestamp/frame + factual observation`
- `anchor_rationale = one sentence tying evidence to the written anchor`
- `audience_finding = STRONG EVIDENCE | USABLE EVIDENCE | LIMITED EVIDENCE | COUNTEREVIDENCE | N/O`
- `accessibility_flag`, if applicable
- `notes`, limited to unresolved ambiguity

No total, average, percentage, stars, universal rank, or cross-audience arithmetic may be calculated.

## N/O handling during calibration

Use N/O only after eligibility passes.

Allowed codes for this corpus:

- `N/O—FORMAT`: the clip does not contain or attempt the task measured by that metric.
- `N/O—CORPUS`: portfolio contribution cannot be assessed until the required comparison set exists.

Use `0`, not N/O, when the metric applies but the evidence is absent, contradicts the intended claim, or performs the task unsuccessfully.

Incomplete retrieval is never N/O.

## Accessibility during calibration

Apply the frozen policy exactly:

- if meaningful audio is required for comprehension and no accurate equivalent is present, flag `REMEDIATION REQUIRED—CAPTIONS` and cap execution quality at 2/3;
- do not reduce unrelated metrics solely because captions are missing;
- if essential visual information would require description in the intended presentation, flag it without inventing an automatic score penalty beyond the frozen policy.

## Independent scoring sequence

For each clip:

1. Evidence Auditor verifies full retrieval.
2. Eligible source package is frozen.
3. Relevant evaluators receive the same blinded package.
4. Evaluators score independently.
5. All submissions are locked before anyone sees another evaluator's work.
6. Agreement statistics are computed within the same metric and perspective instruction.
7. Chair opens only the disagreements requiring reconciliation.
8. Evidence Auditor verifies all disputed citations.
9. Chair reconciles against source evidence and anchor language.
10. Minority-but-defensible findings are preserved rather than averaged away.

## Disagreement detection

A disagreement is material when any of these occur within the same metric/perspective instruction:

- exact numeric scores differ;
- one evaluator uses N/O and another uses a numeric score;
- numerical scores differ by more than one point;
- audience findings differ by two or more levels;
- evaluators cite materially different factual interpretations of the same source moment;
- one evaluator's conclusion depends on evidence the Auditor cannot verify.

Cross-role disagreement is not automatically an error because different roles intentionally answer different questions.

## Version 1 calibration thresholds

These are operating thresholds, not scientifically validated constants.

For each metric within the same perspective instruction:

1. **Exact score agreement:** at least 75% of comparable ratings must match exactly.
2. **Residual spread:** every remaining valid numeric disagreement must differ by no more than one point.
3. **Applicability agreement:** N/O versus numeric agreement must be at least 90%.
4. Report raw counts and denominators alongside percentages.

A metric passes only if all applicable thresholds pass.

## Chair cross-examination process

For every material disagreement:

1. State both conclusions without naming evaluator identity where possible.
2. Put the cited timestamps/frames side by side.
3. Verify the factual observations with the Evidence Auditor.
4. Identify the exact rubric anchor each evaluator invoked.
5. Classify the disagreement as one of:
   - `EVIDENCE ERROR`
   - `ANCHOR AMBIGUITY`
   - `APPLICABILITY ERROR`
   - `AUDIENCE-PERSPECTIVE DIFFERENCE`
   - `DEFENSIBLE MINORITY JUDGMENT`
6. Correct evidence or applicability errors.
7. If the anchor is ambiguous, do not force a score; flag the metric for revision.
8. If both interpretations remain supportable, preserve the majority result plus a minority note. Do not average.

## Metric-specific failure and retest

If any metric fails calibration:

1. Do not revise unrelated metrics.
2. Diagnose the failure from disagreement records.
3. Revise only the affected definition, scoring anchor, applicability rule, or evaluator instruction.
4. Record the exact change and why it was made.
5. Select at least 6 replacement clips that were not used to create the revision.
6. Blind-score those replacement clips under the revised rule.
7. Apply the same Version 1 thresholds.
8. Repeat until the metric passes or human review determines the construct cannot be made reliable enough for this system.

No Ashley video may be scored while any metric remains failed.

## Minority judgments

A minority judgment is retained when:

- its factual evidence is verified;
- it uses the correct applicability rule;
- its score fits a written anchor;
- the Chair cannot show that it is factually or procedurally wrong.

Record:

- majority result;
- minority result;
- evidence for each;
- why the disagreement remains defensible.

Do not convert the minority into an average or suppress it merely to improve agreement statistics.

## What freezes after calibration

After all ten metrics pass and human review approves the outcome, freeze:

- metric definitions;
- scoring anchors;
- N/O applicability rules;
- evaluator-role instructions;
- accessibility treatment;
- calibration thresholds and calculation method;
- evidence citation requirements;
- disagreement taxonomy;
- Chair reconciliation procedure;
- rubric version identifier.

Any later change creates a new rubric version and must document whether recalibration is required.

## Calibration output

The calibration run must produce:

- calibration-set manifest;
- retrieval eligibility log;
- blinded evaluator records;
- per-metric agreement calculations;
- N/O agreement calculations;
- disagreement log;
- Chair reconciliation log;
- metric pass/fail table;
- revisions and replacement-clip retests, if any;
- final frozen rubric version proposed for human approval.

## Stop condition

Phase 2B is complete when this protocol exists and is human-reviewed. Do not begin Ashley scoring merely because the protocol document is complete. The next operational phase is selecting and freezing the unrelated calibration set, then running blind calibration.