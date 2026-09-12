# Portfolio Video Calibration Sample

Status: Frozen random sample from Ashley Brooke Cohen's own known social-video URLs for internal calibration.

## Sampling method

- Source pool: 22 known Ashley-owned social-video URLs already collected for this project (1 Instagram Reel + 21 TikTok URLs).
- Sample size: 12.
- Selection method: simple random sample without replacement.
- Reproducibility seed: `20260912`.
- Important: this is an Ashley-corpus calibration sample, not an external/unrelated-creator validation set. It is useful for testing the rubric on the actual content distribution the portfolio will evaluate, but it does not by itself establish general inter-rater validity outside Ashley's corpus.

## Frozen sample

1. TikTok — https://www.tiktok.com/t/ZP83DVEWH/
2. TikTok — https://www.tiktok.com/t/ZP83DnwFy/
3. TikTok — https://www.tiktok.com/t/ZP83DseUq/
4. TikTok — https://www.tiktok.com/t/ZP83DbJpX/
5. Instagram — https://www.instagram.com/reel/Dcdz3BAOFwG/?stkn=MWF2YjRyNmx1Yzdmag==
6. TikTok — https://www.tiktok.com/t/ZP83DHGy7/
7. TikTok — https://www.tiktok.com/t/ZP83DgrXF/
8. TikTok — https://www.tiktok.com/t/ZP83DfPxA/
9. TikTok — https://www.tiktok.com/t/ZP83Du8nk/
10. TikTok — https://www.tiktok.com/t/ZP83Dy2Uy/
11. TikTok — https://www.tiktok.com/t/ZP83DG9rv/
12. TikTok — https://www.tiktok.com/t/ZP83Dmumv/

## Eligibility gate before scoring

Every sampled item must first pass the existing full-retrieval requirement at `2/2` confidence. If the full video, spoken audio/transcript, on-screen text, representative frames, original caption/post text, duration, URL, and available public metadata cannot be retrieved, that item is not scored and is recorded as:

`ELIGIBILITY: FAIL — RETRIEVAL BUG`

Do not replace a failed item silently. Any replacement must be randomly drawn from the remaining unsampled pool and documented with the same seed/process or a clearly recorded replacement draw.
