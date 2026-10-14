# Cloudflare browser test — October 14, 2026

Observed: The existing GitHub-to-Cloudflare pipeline worked. The development branch intentionally stopped its own deployment using a build guard. That did not require new infrastructure to serve a browser-only test.

Resolution: An isolated browser page was added behind the website's existing authenticated control route. PR #12 merged to main at 75818445177d04821323cf1be0492917b5548f64. The iPhone accessed the page over HTTPS and loaded a real MP4.

Separate failure: Three frame captures looked identical. PR #14 contains an unverified candidate fix. Do not mark frame fidelity passed until actual device review succeeds.

Reusable troubleshooting sequence: locate first failing layer; isolate minimum change; preserve safeguards and other routes; test and use existing deployment pipeline; independently verify the real user experience.

Tooling incident: Two attempts to append this lesson to docs/TROUBLESHOOTING_LOG.md were blocked by tool safety checks. A successful branch write does not mean the canonical log was updated. Do not retry an identical blocked write indefinitely; preserve a traceable record and reconcile through normal review.
