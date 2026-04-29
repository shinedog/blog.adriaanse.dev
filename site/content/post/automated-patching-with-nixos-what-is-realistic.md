---
title: "Automated Patching with NixOS: What Is Actually Realistic"
date: 2026-03-08T09:00:00.000Z
description: >-
  Automated patching is the goal. Unplanned downtime from a bad patch is the
  risk. Here is what we actually automate, what we do not, and why.
draft: true
---

"Patch regularly" is on every security compliance checklist. "Patching caused our outage" is on every postmortem that skipped testing. There is a tension here that is worth being honest about.

## What automatic means

When people say "automated patching" they usually mean one of:
1. Security updates applied automatically, immediately, with no testing
2. Regular update cycles, tested, with a defined rollout procedure
3. Something in between

We do option 2. Here is the reasoning.

## Why we do not apply security patches immediately and automatically

The appeal is obvious: critical CVE published, patch deployed within hours, no human required. The problem: patches break things. A kernel update that fixes a privilege escalation might also change a behaviour that a service depends on. For a small organisation where downtime has direct business impact, a self-inflicted outage is often worse than the theoretical risk of an unpatched vulnerability.

This is not an argument against patching quickly. It is an argument for testing before deploying.

## Our patch cycle

We run weekly `nix flake update` on the fleet repository. The update process:

1. `nix flake update` — updates `flake.lock` to current nixpkgs
2. `nix build` for each host configuration — verifies the new config evaluates without errors
3. `nix flake check` — runs the NixOS test suite for our modules
4. Deploy to a staging host (usually the monitoring host, which has the lowest blast radius)
5. Wait 48 hours
6. Deploy to remaining hosts

For a critical CVE (CVSS 9.0+), we compress the timeline: deploy to staging immediately, wait 24 hours, deploy to production. The staging step is not skipped.

## What we do automate

Automatic security updates for packages that cannot meaningfully break the OS: browsers, office tools, developer tools on workstations. These are user-space applications with no system-level dependencies. An automatic update to Firefox does not affect system stability.

We also automate certificate renewal (ACME/Let's Encrypt via the NixOS ACME module). Certificate expiry is a clear failure mode; renewal is low-risk. Automation is the right call.

## NixOS channel auto-upgrade option

NixOS has `system.autoUpgrade` which will run `nixos-rebuild switch` on a schedule. We do not use it for production hosts because it bypasses the test-and-stage process. We mention it because it exists and it is tempting—but "the system upgraded itself and something broke" is a difficult postmortem to have with a client.

```nix
# We do NOT enable this on production
# system.autoUpgrade = {
#   enable = true;
#   channel = "https://nixos.org/channels/nixos-24.11";
#   dates = "04:00";
# };
```

## The honest answer

Perfect automated patching with zero risk does not exist. The best achievable state is: a short, predictable patch cycle, automated testing, staged rollout, and monitoring that detects regressions quickly. NixOS makes the last three of those easier. The first one is still a commitment.
