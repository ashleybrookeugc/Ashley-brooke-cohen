# Second-Model Blind Calibration Packet

Status: Ready for use in a fresh model/session as an independent second evaluator.

## Purpose

Use a fresh model/session to independently evaluate the same provisional calibration sample without seeing any prior scores, prior board conclusions, or old Feature/Keep/Skip labels. This does not replace the final full-evidence calibration protocol; it is a second-model independence check using the currently available cached evidence.

## Critical blinding rules

The second model MUST NOT read or use:

- `docs/PORTFOLIO_VIDEO_PROVISIONAL_CALIBRATION.md`
- any previous Feature / Keep / Skip labels
- any AI-generated portfolio titles
- any previous evaluator scores or conclusions

The second model MAY read only:

1. `docs/PORTFOLIO_VIDEO_RESEARCH_SPEC.md`
2. `docs/PORTFOLIO_VIDEO_RUBRIC_RESEARCH.md`
3. `docs/PORTFOLIO_VIDEO_RUBRIC_POLICY.md`
4. `docs/PORTFOLIO_VIDEO_CALIBRATION_PROTOCOL.md`
5. `docs/PORTFOLIO_VIDEO_ANALYSIS.json`
6. this packet

## Evidence limitation

This pass uses cached analyzer summaries, not complete transcript/timeline packages. Therefore:

- Do not invent timestamps.
- Do not score execution details that cannot be supported by the cached evidence.
- Do not calculate final inter-rater validity from missing timeline evidence.
- Treat this as a provisional second-model check only.
- Ignore all old `suggested_title` fields and old `portfolio_recommendation` fields in the JSON.

## Provisional sample

Evaluate only these 10 cached clips:

1. `https://www.tiktok.com/t/ZP83DnwFy/`
2. `https://www.tiktok.com/t/ZP83DseUq/`
3. `https://www.tiktok.com/t/ZP83DbJpX/`
4. `https://www.tiktok.com/t/ZP83DHGy7/`
5. `https://www.tiktok.com/t/ZP83DgrXF/`
6. `https://www.tiktok.com/t/ZP83DfPxA/`
7. `https://www.tiktok.com/t/ZP83Du8nk/`
8. `https://www.tiktok.com/t/ZP83Dy2Uy/`
9. `https://www.tiktok.com/t/ZP83DG9rv/`
10. `https://www.tiktok.com/t/ZP83Dmumv/`

Do not evaluate the two frozen-sample clips that lack cached records in `PORTFOLIO_VIDEO_ANALYSIS.json`.

## Evaluator roles

Apply these perspectives independently before reconciling:

1. First-Time Viewer
2. Agent / Talent Evaluator
3. Casting Director / Producer
4. Brand / Performance Marketer
5. Creative Collaborator
6. Short-Form Creative Director
7. Portfolio Editor

The Evidence Auditor and Chair are procedural roles, not ordinary scorers.

## Metrics

Use the researched 10-metric rubric exactly as defined in the research/policy files:

1. identity clarity
2. capability proof
3. credibility
4. distinctiveness
5. audience relevance
6. communication effectiveness
7. execution quality
8. portfolio contribution
9. commercial usefulness
10. entertainment/casting usefulness

Authorship is NOT a metric.

## N/O rules

Only use:

- `N/O—FORMAT`
- `N/O—CORPUS`

Do not use authorship-based N/O.

Use numeric weakness instead of N/O when the task applies but is weakly executed or weakly evidenced.

## Scoring behavior

For every role × relevant metric judgment:

- score `0 | 1 | 2 | 3 | N/O—FORMAT | N/O—CORPUS`
- cite the exact cached factual evidence supporting the judgment
- tie the judgment to the written rubric anchor
- do not infer views, retention, conversions, professionalism, booking likelihood, or off-camera behavior
- do not reward a recognizable brand merely for appearing in-frame
- do not treat visual/background wardrobe range as acting range
- do not treat unusual subject matter alone as distinctiveness
- do not infer editing/writing authorship beyond the project policy

If cached evidence is insufficient to support a metric reliably, mark the judgment `EVIDENCE-LIMITED` and explain what specific missing evidence prevents a defensible score. Do not guess.

## Independence requirement

Work through each clip without consulting any prior calibration output. Do not attempt to agree with an earlier model. The purpose is to surface disagreement.

## Output format

Create one record per clip with:

- URL
- each evaluator role
- metric scores relevant to that role
- evidence statement for each score
- audience finding: `STRONG EVIDENCE | USABLE EVIDENCE | LIMITED EVIDENCE | COUNTEREVIDENCE | N/O`
- `EVIDENCE-LIMITED` notes where necessary

Then create:

### SECOND-MODEL CROSS-CLIP FINDINGS

Identify which metrics appear stable and which remain ambiguous based solely on this independent pass.

### SECOND-MODEL N/O FINDINGS

Flag any cases where FORMAT vs numeric scoring is difficult.

### SECOND-MODEL DISAGREEMENT RISKS

Predict which metric boundaries most need adjudication.

Do NOT compare against the first model. That comparison will happen later in the original session.

## Return block

Return only this summary after saving the detailed result:

`SECOND MODEL PASS: COMPLETE / INCOMPLETE`
`CLIPS EVALUATED: X/10`
`EVIDENCE-LIMITED CLIPS:`
`FILE CREATED/UPDATED:`
`METRICS NEEDING ADJUDICATION:`
`NEXT: Return this result to the original session for blinded comparison.`
