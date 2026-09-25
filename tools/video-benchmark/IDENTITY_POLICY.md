# Calibration source identity policy

Each calibration entry has two separate identities:

1. **Logical source identity** — the durable public work being referenced, such as Instagram Reel post `Dcdz3BAOFwG`.
2. **Exact retrieved representation identity** — one concrete byte representation, identified by SHA-256 and its recorded media/provenance metadata.

The top-level `sha256` and `duration_seconds` are the immutable frozen representation for backward compatibility. `frozen_representation` repeats that immutable identity explicitly. Later bytes belong in `observed_representations`; do not overwrite the frozen representation to make a retrieval pass.

## Identity outcomes

| Outcome | Meaning | Exact representation gate |
| --- | --- | --- |
| `EXACT_REPRESENTATION_MATCH` | Retrieved SHA-256 equals the frozen SHA-256. | Pass for that source. |
| `LOGICAL_SOURCE_CONTINUITY_WITH_REPRESENTATION_DRIFT` | Retrieved SHA-256 matches a recorded later representation with independently evidenced continuity to the same logical source. | Not an exact match; the corpus exact-representation gate does not pass. |
| `SOURCE_IDENTITY_UNRESOLVED` | SHA differs and the evidence does not establish continuity. | Fail closed; investigate. |
| `WRONG_SOURCE` | Evidence establishes that the retrieved bytes belong to a different logical source. | Fail. |

## Evidence required for representation drift

A hash mismatch is **not** continuity just because the URL, platform, duration, audible material, or downloader succeeded. A recorded drift observation must contain:

- the observed representation SHA-256 and media/provenance details;
- the observed logical-source ID, equal to the registry logical-source ID;
- independent evidence of that ID (`platform_post_id_observed`); and
- independent historical representation provenance showing why the continuity conclusion is supportable.

The source-specific record must preserve limitations. It may establish continuity while leaving the cause of drift unresolved.

## Source 05

`ashley-social-05` preserves the frozen `4549c6…dd9f` representation and separately records the target-Mac `660608…f6a2` representation. Its outcome is `LOGICAL_SOURCE_CONTINUITY_WITH_REPRESENTATION_DRIFT`: both identify Reel `Dcdz3BAOFwG`, but POST/MEDIA CHANGE and REGISTRY ERROR are not established. The exact-representation gate remains not passable.
