# Always-on video analyzer on Oracle Cloud

This is the setup for Ashley's private video analyzer. The computer is an Oracle Cloud Always Free Ampere machine. Ashley's website stays where it is. The phone still opens `/video-test/` and signs in as Mary Kate. The website talks to this computer through a private tunnel. There is no public web address for the analyzer.

Russell chose Oracle for this on 31 October 2026. The account did not exist yet when these files were written. Create the account, create the VM, paste the startup script, then run the commands in section 6.

Do not use the Grok Bot computer for this. Its network blocks the tunnel. Do not delete the Mac Studio tunnel. Its name is `mk-video-test-private`. Its Cloudflare VPC service is `01a141ad-d6e8-7ae0-804c-0f98e58320ad`. Leave both in place until an iPhone upload through the new computer has worked.

## 1. What you are creating

One small computer that stays on:

- Shape `VM.Standard.A1.Flex`
- 2 OCPUs and 12 GB of memory
- Ubuntu 24.04 for Arm (the normal Ubuntu image, not Minimal Ubuntu)
- A boot disk of 150 GB
- SSH key login only
- No open door except SSH
- The analyzer listens only on `127.0.0.1:8789` on that computer

The website reaches it through Cloudflare's private VPC service. The tunnel's public side answers 404. There is no DNS name for the analyzer.

## 2. Oracle account

Sign up at [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/).

Oracle's own pages, checked 31 October 2026:

- A credit card or a debit card that works like a credit card is required to prove who you are. Oracle says the temporary card check is not a charge. They do not take PIN-only debit cards, virtual cards, or prepaid cards. Source: [Free Tier FAQ](https://www.oracle.com/cloud/free/faq/).
- Pick the home region during signup. Always Free computers must live in that home region, and you cannot change the home region later. Source: [Free Tier](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm) and [Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).
- Choose a home region that can create Ampere A1 machines. If the region you want has no A1 room, pick a nearby region before you finish signup.
- The free Ampere allowance is the first 1,500 OCPU hours and 9,000 GB hours each month. Oracle says that for an Always Free account this is the same as one 2 OCPU, 12 GB computer running all month. Do not create a second Ampere computer, and do not raise this one above 2 OCPUs or 12 GB. Source: [Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).
- Block storage is 200 GB total, boot disk included. A 150 GB boot disk leaves 50 GB unused. A 200 GB boot disk uses the whole free allowance, so you could not add another disk later. The console often suggests 50 GB. 50 GB can fill up because finished videos are kept on this computer. Use 150 GB.
- If the create button says **out of host capacity**, Oracle's FAQ says the free shape is temporarily full in that home region. Try another availability domain if the region has more than one. Then wait and try again. It can take days. Upgrading the account to Pay As You Go gives access to more capacity. Oracle says you are not billed for usage that stays inside the Always Free amounts. Source: the same Always Free page, and the [Free Tier FAQ](https://www.oracle.com/cloud/free/faq/) answer for "out of host capacity".

Idle shutdown: Oracle may reclaim an Always Free computer that, for 7 days, stays under 20% CPU, under 20% network, and (for A1) under 20% memory. This analyzer will sit idle between uploads, so an Always Free account can lose the machine. Source: [Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm), section "Reclamation of Idle Compute Instances".

Pay As You Go: Oracle's customer notice to Always Free accounts says you can keep an idle computer from being stopped by upgrading to Pay As You Go, and that usage inside the Always Free limits is not billed. That exemption is the customer notice, not a sentence on the current Always Free resources page. The resources page does say an upgrade is not charged for Always Free usage and can help when capacity is short. Upgrade if you want the machine to stay up while idle. In the Oracle console, set a budget alert at $1 so a mistake is visible. Do not add paid shapes, extra disks, or a load balancer.

After the 30-day trial, keep this one Ampere computer inside the free size. Oracle deletes extra Ampere computers on an account that does not upgrade. Source: [Free Tier](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm).

## 3. Create the VM

In the console: Compute, Instances, Create instance.

Use these settings:

| Setting | Value |
| --- | --- |
| Name | `oracle-video-analyzer` |
| Image | Canonical Ubuntu 24.04. The name looks like `Canonical-Ubuntu-24.04-aarch64`. Use the normal Ubuntu image. Do not use Minimal Ubuntu. Oracle says Minimal Ubuntu is not the image for Arm shapes. Source: [Platform Images](https://docs.oracle.com/en-us/iaas/Content/Compute/References/images.htm). |
| Shape | Click Change shape, Ampere, `VM.Standard.A1.Flex`. Set 2 OCPUs and 12 GB memory. |
| Boot volume | Custom size, 150 GB. |
| Networking | Create a new virtual cloud network and a public IPv4 address. Do not add rules that open port 80 or 443. SSH (port 22) is the only inbound port. |
| SSH key | Paste your own public key. Do not set a password. |
| Initialization script | Paste the whole file `deploy/oracle-analyzer/cloud-init.yaml`. |

The startup script installs the programs, closes inbound traffic except SSH, downloads the code, and downloads the speech model. It does not start the analyzer until section 6.

Oracle Ubuntu images already have firewall rules so the computer can see its disk. Those rules use the addresses `169.254.0.2` and `169.254.2.0` on port 3260. Do not turn on UFW. Oracle's known-issues page says enabling UFW can remove those rules and the computer then will not reboot. Source: [Known Issues for Compute](https://docs.oracle.com/en-us/iaas/Content/Compute/known-issues.htm) and [Essential Firewall Rules](https://docs.oracle.com/en-us/iaas/Content/Compute/References/bestpracticescompute.htm). The startup script edits the existing iptables file and keeps those disk rules.

## 4. Wait for the first boot

The instance page shows Running before the script has finished. The script installs Node, Python, ffmpeg, and the speech model. Give it time.

Then SSH in as the `ubuntu` user with your key:

```sh
ssh ubuntu@THE_PUBLIC_IP
```

Look at the end of the startup log:

```sh
sudo tail -n 80 /var/log/cloud-init-output.log
```

You want a line that says `bootstrap finished`. If the log stops on an error, do not create a second computer. Copy the last error and fix that step. Running the script again is safe:

```sh
sudo bash /var/lib/oracle-analyzer/website/deploy/oracle-analyzer/bootstrap.sh
```

## 5. Create the private tunnel

Do this on the new computer, in the SSH session. Keep the command running until the browser says you are logged in. A login that exits before you click looks like a button that does nothing.

```sh
cloudflared tunnel login
```

A browser page opens. Sign in to Ashley's Cloudflare account and approve the login. When the command finishes, this file exists:

```sh
ls -l ~/.cloudflared/cert.pem
```

Create the tunnel. This does not publish a website name.

```sh
cloudflared tunnel create oracle-video-analyzer
```

The command prints a tunnel id that looks like `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`. Copy that id. Then:

```sh
sudo /usr/local/lib/oracle-analyzer/install-tunnel-credentials.sh THE_TUNNEL_ID
```

That writes a config whose only rule is "answer 404". It does not create a public hostname or a DNS record.

If browser login on the VM is awkward, you can instead create a remotely managed tunnel in the Cloudflare dashboard and put its token in `/etc/oracle-analyzer/secrets/tunnel-token` (root and the analyzer group only, mode `0440`). On the tunnel's page, the public hostname list must stay empty and the catch-all must be HTTP 404. The token is not stored in git.

Do not revive the unused tunnel `abc-video-box` (`09bad014-b1cc-45bd-be74-62b2cba0fd0a`). Do not use a hidden edge-IP pin.

## 6. The commands after cloud-init

Still in the SSH session:

```sh
sudo /usr/local/lib/oracle-analyzer/create-worker-token.sh
```

That prints a long token once. Copy it into a password manager. You will paste it into Cloudflare in section 7. It is not written to git.

```sh
sudo /usr/local/lib/oracle-analyzer/finish.sh
```

`finish.sh` starts the analyzer and the tunnel, and then runs the self-check. A passing self-check ends with `healthcheck passed`. The analyzer is then listening on this computer only, at `127.0.0.1:8789`.

You can run the self-check again any time:

```sh
sudo /usr/local/lib/oracle-analyzer/healthcheck.sh
```

## 7. Cloudflare, after the self-check passes

The website code still ships the normal way: GitHub `main` to Cloudflare Workers Builds. Do not deploy by hand. Two Cloudflare settings change, and only after this computer's self-check passed.

1. In the Cloudflare dashboard, create a new Workers VPC service for the new tunnel. Point it at host `127.0.0.1` and port `8789`, on the new tunnel id. The existing service `01a141ad-d6e8-7ae0-804c-0f98e58320ad` (`mk-video-test-loopback`, tunnel `mk-video-test-private` / `421e73e9-0364-4775-a0ca-6b27c9c3164b`) stays until the iPhone test works. You can instead edit that existing service to the new tunnel id, but do not delete it first. If you edit it in place, the Mac path stops at that moment, so do that only when you are ready to test the phone immediately.

2. Open a pull request that changes `vpc_services.service_id` in `wrangler.jsonc` to the new service id, if you created a new service. Merge that through the normal path. Wait until the Workers Build for that commit is the version serving production.

3. Confirm the latest uploaded Worker version and the active production version are the same version. Wrangler's secret command updates the latest uploaded version and cannot pick a different base. If a preview is newer than production, stop. This lesson is in `docs/TROUBLESHOOTING_LOG.md` (15 October 2026, signed 401 diagnosis).

4. From a checkout of that production commit, with Wrangler logged into Ashley's account:

```sh
npx wrangler secret put VIDEO_TEST_WORKER_TOKEN
```

Paste the token from section 6. Do not put the token in the command line. This is a Worker runtime secret, not a Builds variable.

5. Do not delete `mk-video-test-private` or service `01a141ad-d6e8-7ae0-804c-0f98e58320ad` until section 8 has passed. Stopping the Mac connector can wait until the new path has worked on a phone. Deleting comes later, after a second successful day, and is a separate decision.

## 8. iPhone test

1. On the iPhone, open the site's `/video-test/` page.
2. Sign in the usual Mary Kate way if the page asks. There is no second password for video.
3. Choose a short clip from Photos or Files.
4. Press Analyze.
5. Wait until the review appears. One analysis runs at a time. The cap is 64 MB.

If the page says the analyzer is unavailable, the tunnel or the token does not match yet. The Mac path is still the live path until the service id change is what's serving production. Do not delete the Mac tunnel to "make the new one work".

## 9. Updates

A timer runs once a day, around 07:30 UTC. It downloads the website ref and the analyzer ref named in `/etc/oracle-analyzer/analyzer.env`, runs tests in a copy of the code, and switches to the new code only if the tests pass. The live copy stays on the last good version when tests fail.

The analyzer suite has one frozen failure that is allowed: the test named `ASR preserves tested connector words and negation with versioned word timestamps`. It still expects the old engine name `PocketSphinx`. Do not edit that test. Any other failure blocks the update.

After this pull request is on `main`, edit `/etc/oracle-analyzer/analyzer.env` and set `ORACLE_ANALYZER_WEBSITE_REF=main`. The analyzer ref stays `cursor/oss-video-extractors-8f87` until that work has a stable branch of its own. To freeze a revision, put the full git SHA in the ref line.

The speech model is the pinned `base.en` revision `3d3d5dee26484f91867d81cb899cfcf72b96be6c`. Setup downloads it. Later runs do not download a different model.

Security updates install on their own and do not reboot the computer. Reboot on purpose when you want a kernel update:

```sh
sudo reboot
```

The services start again after the reboot.

## 10. Turn on correction backup

This is off. Leave it off until you want a copy of the correction notes.

The backup copies only the small JSON files under `VIDEO_TEST_ROOT/<job>/feedback/`. It does not copy the video, the audio, the frames, or the evidence package. Run it only against a private GitHub repository.

1. Create a new private GitHub repository. The lock icon must say Private. Example name: `video-test-corrections`. Do not use the website repository.
2. Create a fine-grained personal access token. Repository access: only that one repository. Permission: Contents, read and write. No other permissions.
3. On the VM, store the token where only root and the analyzer user can read it:

```sh
sudo install -d -o root -g analyzer -m 0750 /etc/oracle-analyzer/secrets
sudo bash -c 'umask 077; cat > /etc/oracle-analyzer/secrets/backup-github-token'
```

Paste the token, press Enter, then Ctrl-D. Then:

```sh
sudo chown root:analyzer /etc/oracle-analyzer/secrets/backup-github-token
sudo chmod 0440 /etc/oracle-analyzer/secrets/backup-github-token
```

4. Edit `/etc/oracle-analyzer/analyzer.env`:

```
ORACLE_ANALYZER_BACKUP_ENABLED=1
ORACLE_ANALYZER_BACKUP_REPO=https://github.com/OWNER/video-test-corrections.git
ORACLE_ANALYZER_BACKUP_BRANCH=main
```

5. Optional encryption. On your own computer, not in git:

```sh
age-keygen -o backup-age-identity.txt
```

Put the `age1...` public key line in `/etc/oracle-analyzer/secrets/backup-age-recipient.pub` on the VM (mode `0440`, group `analyzer`). Keep `backup-age-identity.txt` in a password manager. The VM does not need the private key. If the private key is lost, the encrypted copies cannot be read. If you skip this step, the private repository is the protection and the JSON is stored as plain text.

6. Run it once:

```sh
sudo /usr/local/lib/oracle-analyzer/backup-corrections.sh
```

7. Open the private repository and check the files. You should see `feedback/<job-id>/<note>.json` (or `.json.age`), `manifest.json`, and `README.md`. You should not see `.mp4`, `.mov`, `.jpg`, `.wav`, or `source.bin`.

The nightly timer is already installed. While backup is disabled it prints `backup: disabled` and uploads nothing. The script refuses to upload if GitHub says the repository is not private.

## 11. If the self-check fails

- `UFW is active`: turn UFW off and restore `/etc/iptables/rules.v4` from `rules.v4.oracle-analyzer-bak` if that file exists. Do not enable UFW again.
- `iptables rules are missing`: the Ubuntu image did not have Oracle's disk rules where the script expected them. Do not invent a new firewall that drops `169.254` traffic. SSH still works. Ask for help before changing iptables.
- `RapidOCR runtime self-check` failed: rerun `bootstrap.sh`. It will reuse the existing checkout and reinstall the Python environment.
- `loopback health is not available`: the token file is missing, too short, or readable by every user on the machine. `finish.sh` explains which file.
- Tunnel restarts forever: `journalctl -u oracle-analyzer-tunnel.service -n 50`. Outbound UDP and TCP port 7844 must be allowed. This Oracle computer has normal outbound internet. The Grok Bot computer does not.

Logs:

```sh
sudo journalctl -u oracle-analyzer-adapter.service -n 80 --no-pager
sudo journalctl -u oracle-analyzer-tunnel.service -n 80 --no-pager
sudo journalctl -u oracle-analyzer-update.service -n 80 --no-pager
```

The adapter token and the tunnel token must not appear in those logs. If they do, rotate them.
