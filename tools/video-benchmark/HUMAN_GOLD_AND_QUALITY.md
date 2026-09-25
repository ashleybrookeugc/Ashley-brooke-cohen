# Human gold and component-quality protocol

This contract prepares target-Mac component benchmarks. It does not establish component quality, and automated output must never be copied back as human gold.

## Preconditions

For each source, first pass `verify-corpus` against the frozen SHA-256. A human then reviews the complete source from beginning to end with direct audio audition and visual inspection. Mark any inaccessible interval, inaudible speech, obscured text, or ambiguous visual event explicitly; do not repair it from ASR/OCR.

Record every span as `start_seconds` / `end_seconds`, source SHA-256, the verification method, and one of `observable`, `inaudible_or_obscured`, or `uncertain`. Gold `complete` means complete direct human review plus every lane either `complete` or `not_applicable`; it never means a model output merely looked plausible.

## Required human evidence lanes

| Lane | Human records | Gold scoring unit |
| --- | --- | --- |
| `spoken_text` | Exact intelligible wording, sentence/turn boundaries, connector words, negation, pronouns, qualifiers, and known uncertainty. | Word/token alignment and timestamp error; critical-token exactness. |
| `speaker_turns` | Turn boundaries, overlap, and neutral labels (`speaker_1`, `speaker_2`) only. Identity is `unknown` unless separately evidenced. | Turn-change precision/recall and boundary error. |
| `burned_in_caption` | Caption text and temporal persistence, independently of what is heard. | Text match plus caption classification. |
| `other_on_screen_text` | Meaningful UI, graphics, signage, product, or other text separately from captions. | Text match plus non-caption classification. |
| `scene_edit` | Material cuts, transitions, inserts, b-roll, screenshots, and state changes. | Boundary precision/recall within tolerance. |
| `semantic_visual` | Directly observable subjects, actions, objects/products, setting, UI/app state, and inserts. No emotional/personality claims. | Event precision/recall and unsupported-claim count. |

`spoken_text` ≠ `burned_in_caption` ≠ `other_on_screen_text`. When speech and visible text disagree, preserve both in `modality_conflicts`; neither overwrites the other.

## Candidate receipts and acceptance gates

Every target-Mac candidate receipt must name the frozen source SHA-256, component/version, model/version/configuration, exact command, duration/resolution, runtime, measurable memory/resource observation, artifact locations, warnings, and these independent outcomes:

- **Operational PASS**: the exact pinned component runs on verified target source bytes, produces parseable, timestamped output for its applicable lane, and records no silent fallback. This says nothing about accuracy.
- **Quality PASS**: human-gold comparison passes every applicable gate below. `NOT APPLICABLE` is valid for a source without the modality; `BLOCKED`/`UNTESTED` cannot be promoted to PASS.

| Capability | Minimum quality gate for a candidate to be considered for composition |
| --- | --- |
| ASR | Report WER and word-timestamp error; no missed/substituted critical connector, negation, pronoun, qualifier, or complete gold turn; median word timing error ≤0.50 s on scored words. |
| Diarization | Unknown-speaker labels only; report turn-change precision/recall and boundary error; no asserted personal identity; every gold multi-speaker turn must be represented or explicitly missed. |
| OCR / classification | Report normalized text precision/recall separately for captions and other text; no lane collapse; every gold disagreement remains a conflict record. |
| Scene segmentation | Report boundary precision/recall at ±0.50 s; every missed/spurious material boundary is enumerated. |
| Dedup / sampling | 100% recall of human-marked meaningful captions, products, reactions, inserts, and UI-state changes; reduction rate is reported but never traded for lost evidence. |
| Semantic vision | Event precision/recall against direct-observation gold; every claim cites frame/time provenance; zero unsupported emotional/personality assertions. |
| Multimodal reconstruction | Whole source is time-aligned with source-linked lanes, conflict records, uncertainty, and no flattened OCR-to-dialogue reconstruction. |

The corpus is too small and incomplete to set a production-wide winner from a single average. Candidate selection remains **open** until the target-Mac receipts include enough applicable source evidence and the open corpus categories are filled.

## Target-Mac execution order

1. Verify every currently available source byte hash; stop on mismatch.
2. Create the local human-gold record using this template and validate its frozen identities:

   ```sh
   node tools/video-benchmark/benchmark.mjs validate-gold \
     --gold /approved/local/path/human-gold.json \
     --corpus tools/video-benchmark/calibration-corpus.json \
     --output artifacts/video-benchmark/human-gold-validation.json
   ```

3. Lock and execute one component candidate at a time. Do not run the full multimodal composition until its upstream quality gates have receipts.
4. Assemble one complete, real-social-video reconstruction and inspect its evidence package/read-back. This remains a later gate, not a result of this preparation work.
