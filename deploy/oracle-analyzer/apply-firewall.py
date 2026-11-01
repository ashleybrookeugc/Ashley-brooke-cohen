#!/usr/bin/env python3
"""Add an inbound SSH-only policy to an Oracle Ubuntu iptables-restore file.

Oracle's Ubuntu platform image reaches its boot volume over iSCSI at
169.254.0.2:3260 and 169.254.2.0/24:3260, and only root may make that
connection. Enabling UFW deletes those rules and the instance then fails to
reboot. This editor never enables UFW. It refuses to touch a rules file that
has no 169.254 lines, and it leaves every 169.254 line byte-for-byte intact.
"""

from __future__ import annotations

import sys

MARKER = "oracle-analyzer-ssh"
RULES = (
    '-A INPUT -i lo -m comment --comment oracle-analyzer-lo -j ACCEPT\n',
    '-A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -m comment --comment oracle-analyzer-established -j ACCEPT\n',
    '-A INPUT -p tcp -m tcp --dport 22 -m comment --comment oracle-analyzer-ssh -j ACCEPT\n',
)


def tighten(text: str) -> str:
    if "169.254." not in text:
        raise SystemExit(
            "refusing to edit iptables rules that do not contain Oracle's 169.254 iSCSI endpoints"
        )
    lines = text.splitlines(keepends=True)
    if not any(line.startswith("*filter") for line in lines):
        raise SystemExit("refusing to edit iptables rules that have no *filter table")
    preserved = [line for line in lines if "169.254." in line]
    in_filter = False
    saw_policy = False
    output: list[str] = []
    inserted = MARKER in text
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("*"):
            in_filter = stripped.startswith("*filter")
        if in_filter and stripped.startswith(":INPUT "):
            # Keep the packet counters. Only the policy changes.
            parts = stripped.split()
            counters = " ".join(parts[2:]) if len(parts) > 2 else "[0:0]"
            output.append(f":INPUT DROP {counters}\n")
            saw_policy = True
            continue
        if in_filter and stripped == "COMMIT" and not inserted:
            output.extend(RULES)
            inserted = True
        output.append(line)
        if stripped == "COMMIT":
            in_filter = False
    if not saw_policy:
        raise SystemExit("refusing to edit iptables rules that have no :INPUT policy")
    if not inserted:
        raise SystemExit("could not find the *filter COMMIT line")
    rendered = "".join(output)
    for line in preserved:
        if line not in rendered:
            raise SystemExit("iSCSI rule would have been dropped; leaving the firewall unchanged")
    if rendered.count(MARKER) != 1:
        raise SystemExit("SSH rule was not inserted exactly once")
    return rendered


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(f"usage: {sys.argv[0]} /etc/iptables/rules.v4")
    path = sys.argv[1]
    with open(path, "r", encoding="utf-8") as handle:
        sys.stdout.write(tighten(handle.read()))


if __name__ == "__main__":
    main()
