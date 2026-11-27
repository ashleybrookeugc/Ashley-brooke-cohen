# Oracle Ampere host for the private video analyzer

The website stays on Cloudflare. This folder is the always-on computer that analyzes video. Nothing here is a public website.

Start with [the runbook](../../docs/ORACLE_ANALYZER_RUNBOOK.md). It is written for the person who creates the Oracle account.

What is here:

- `cloud-init.yaml` is pasted into the Oracle instance screen.
- `bootstrap.sh` installs the machine and can be run again.
- `systemd/` starts the adapter and the private tunnel on boot.
- `update.sh` downloads a newer git revision, runs tests, and restarts only when those tests pass.
- `backup-corrections.sh` is installed but does nothing until backup is turned on. It copies correction notes only, never the video file.
- `healthcheck.sh` is the self-check.

Secrets are files on the VM. They are not in this folder.
