# Portfolio Video Research & Evaluation Specification

## Purpose

The Ashley Brooke Cohen website is an **online business card**. Its job is to help a visitor quickly understand:

1. who Ashley is;
2. what she brings to her work;
3. what she can actually do;
4. why she is credible in the subjects and professional worlds she speaks about;
5. why an agent, casting director, producer, brand/marketer, collaborator, or audience member should want to work with, cast, follow, or trust her;
6. what the relevant next action is.

This video-analysis system exists to help select and organize evidence for that purpose. It is **not** a generic social-media quality grader, virality predictor, or automated copywriter.

## Audience represented by the evaluation board

The system should evaluate every eligible video through several independent perspectives:

- **Agent / talent evaluator** — identity, marketability, professional potential, clarity of positioning.
- **Casting director / producer** — on-camera presence, specificity, timing, range, professionalism, personality, useful evidence beyond a resume.
- **Brand / marketer** — transferable commercial capability, natural communication, product/experience integration, category credibility, ability to make useful short-form content.
- **Creative collaborator** — ideas, taste, humor, curiosity, point of view, creative usefulness, whether Ashley feels like someone worth making work with.
- **First-time audience member** — comprehension, interest, trust, payoff, and why Ashley is worth listening to on this subject.
- **Portfolio editor** — whether this specific example makes the online business card stronger, adds new evidence, and earns limited portfolio space.
- **Evidence auditor / chair** — checks factual support, resolves contradictions, and prevents unsupported scores from surviving.

No single perspective controls the final outcome.

## Non-negotiable eligibility gate

A video is eligible for judgment only when the analyzer has retrieved enough evidence to evaluate the **entire video**.

Required evidence should include, when present in the source:

- beginning through end of video;
- spoken audio / transcript;
- on-screen text;
- visual frames covering the video rather than a single thumbnail;
- original caption/post text;
- duration;
- original URL;
- date and other public source metadata when available.

If the complete video cannot be retrieved, do **not** score it.

Use:

`ELIGIBILITY: FAIL — RETRIEVAL BUG`

There is no useful low-confidence portfolio judgment. Retrieval confidence must be **2/2**. Anything below 2/2 is a bug to diagnose, not an analysis result.

## No invented titles or copy

Do not generate portfolio titles, hooks, captions, slogans, or rewritten post names unless Ashley explicitly asks for copy ideation.

Preserve:

- original post text;
- actual spoken hook;
- actual on-screen wording;
- neutral factual descriptors only when a system label is technically necessary.

## Core research dimensions

Do not assume the meaning of these dimensions. Before coding scoring logic, research each one using credible primary or expert sources relevant to its perspective and document the source-backed definition and scoring anchors.

The current dimensions to research are:

1. **Identity clarity** — how much the example helps a new visitor understand who Ashley is.
2. **Capability proof** — what concrete, transferable skill or professional capability the video demonstrates.
3. **Credibility** — what observable evidence gives a viewer reason to trust Ashley's experience, judgment, taste, expertise, or firsthand perspective in the subject.
4. **Distinctiveness** — whether the example reveals a specific Ashley point of view or combination of experience that is materially less interchangeable with another creator/performer.
5. **Audience relevance** — why one or more real target audiences would care about this example.
6. **Communication effectiveness** — premise comprehension, hook clarity, progression, payoff, and memorability for a first-time viewer.
7. **Execution quality** — on-camera performance, visual storytelling, framing, audio, editing, pacing, text use, and format execution where applicable.
8. **Portfolio contribution** — incremental evidence added to the website after considering redundancy with stronger examples.
9. **Commercial usefulness** — a sub-perspective, not the master metric. Define it from evidence about what brands/marketers actually look for in creator work, not from generic "brand friendly" intuition.
10. **Entertainment / casting usefulness** — define separately from commercial usefulness using evidence about what agents, casting professionals, producers, and directors learn from a performer's public-facing content.

Performance metrics such as views, retention, shares, saves, follows, CTR, or conversions must remain a **separate empirical layer** when available. Do not infer performance from creative quality.

## Scoring architecture

Use small integer scales with explicit anchors, preferably 0–2 or 0–3 per dimension. Every awarded point must be supported by specific evidence from the video.

Example structure:

`Communication effectiveness: 2/2`

`Evidence: 00:00–00:03 — the premise is stated and visually demonstrated immediately; 00:18–00:24 — the payoff directly resolves the opening question.`

Do not accept circular explanations such as "2/2 because the hook is strong."

Subjective criteria must have written anchor definitions before scoring begins.

## Board-room process

Each board member should evaluate the same fully retrieved source **independently** against the rubric relevant to that role.

Then the Evidence Auditor / Chair should perform reconciliation:

1. compare scores and cited evidence;
2. identify material disagreements;
3. challenge unsupported or contradictory claims;
4. resolve disputes against the actual video timeline/source evidence and the researched rubric;
5. record minority/disagreement notes when a genuinely subjective difference remains;
6. produce a final reconciled assessment only after cross-checking.

Do not simply average several model outputs. Disagreement is information and must be examined.

## Corpus-aware evaluation

Some judgments cannot be made correctly from one video in isolation.

The system should become increasingly corpus-aware as more of Ashley's public content is analyzed:

- learn recurring themes without inventing a brand persona;
- identify repeated capabilities and recurring points of view;
- detect redundancy;
- identify unusual examples that expand the picture of Ashley;
- compare new videos against stronger existing evidence;
- preserve the distinction between "good post" and "useful portfolio evidence."

A high-quality video can still have low portfolio contribution if stronger examples already prove the same thing.

## Slow-batch ingestion rule

Profile discovery and video analysis are separate layers.

For Instagram profile ingestion:

- begin with batches of 5;
- process sequentially rather than concurrently;
- save each discovered URL immediately;
- save each successful full analysis immediately;
- never re-analyze an already-cached URL unless explicitly requested or the analyzer version requires a deliberate re-score;
- use at most 2 retrieval attempts per item before marking a retrieval bug;
- do not build a complicated scraping workaround after a single platform change; diagnose the exact failing layer first.

## Output data principles

For each eligible video, retain at minimum:

- original URL;
- original caption/post text when available;
- date when available;
- duration;
- actual spoken/on-screen hook;
- factual summary of what happens;
- format/style;
- inferred subjects/themes;
- board-member scores;
- evidence supporting every score;
- disagreements and chair resolution;
- final reconciled dimension scores;
- portfolio usefulness assessment;
- corpus redundancy/contribution notes;
- analyzer/rubric version.

For ineligible videos, retain the URL and retrieval failure details only. Do not manufacture judgment from incomplete evidence.

## Research standard before implementation

Treat the rubric as a research project. Before implementing or changing a metric:

1. research what the relevant real-world audience actually evaluates;
2. prefer primary sources, platform guidance, industry professionals, casting/agency/marketing expertise, and credible research over generic SEO listicles;
3. distinguish platform guidance from independent evidence;
4. document citations/URLs and the specific claim each source supports;
5. translate supported findings into explicit scoring anchors;
6. identify where evidence is weak or subjective instead of pretending certainty;
7. only then encode the metric into the analyzer.

The goal is not to make the AI "objective." The goal is to make evaluation **evidence-bound, cross-checked, reproducible, auditable, and difficult to get wrong**.

## Website decision rule

The final question is never simply "Is this a good video?"

The final question is:

> Does this example materially improve Ashley's online business card by helping the intended visitor understand who she is, what she brings, why she is credible, and why they should take the next step with her?
