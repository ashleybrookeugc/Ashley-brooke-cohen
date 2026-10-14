# Cloudflare browser test — October 14, 2026

Observed: The existing GitHub-to-Cloudflare pipeline worked. The development branch intentionally stopped its own deployment using a build guard. That did not require new infrastructure to serve a browser-only test.

Resolution: An isolated browser page was added behind the website's existing authenticated control route. PR #12 merged to main at 75818445177d04821323cf1be0492917b5548f64. The iPhone accessed the page over HTTPS and loaded a real MP4.

Separate failure: Three frame captures looked identical. PR #14 contains an unverified candidate fix. Do not mark frame fidelity passed until actual device review succeeds.

Reusable troubleshooting sequence: locate first failing layer; isolate minimum change; preserve safeguards and other routes; test and use existing deployment pipeline; independently verify the real user experience.

Tooling incident: Two attempts to append this lesson to docs/TROUBLESHOOTING_LOG.md were blocked by tool safety checks. A successful branch write does not mean the canonical log was updated. Do not retry an identical blocked write indefinitely; preserve a traceable record and reconcile through normal review.

Frame-capture development checkpoint: PR #14 remains unaccepted on iPhone. A deterministic delayed-decoder test against the real inline page script failed on production `main`: all three canvas captures used decoded time 0 even as `currentTime` moved to 1, 5, and 9 seconds. PR #14's initial candidate passed that case, but failed an adversarial first-callback case: `requestVideoFrameCallback` could return an old frame at media time 0 and the page still captured it. The revised candidate waits for `mediaTime` within 0.25 seconds of each requested time, logs both times, and fails after five seconds if no matching decoded frame is confirmed. Focused page/route tests 4/4 and the branch's full Node suite 116/116 passed. These are simulated timing regressions; the 54 MB iPhone source and Safari decoder were not available in Work, so distinct actual frames remain NOT VERIFIED. The browser-only page still does not upload or run the shared analyzer.
