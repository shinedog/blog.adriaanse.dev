---
title: "Incident Response on a NixOS Fleet: What We Have Learned"
date: 2026-03-29T09:00:00.000Z
description: >-
  Incident response on declarative infrastructure is different from responding
  to traditional systems. The tools and mental model shift. Here is what that
  looks like in practice.
draft: true
---

The first time you respond to an incident on a NixOS fleet, some things are dramatically easier than you expect. A few things are harder. Here is the honest version.

## What is easier

**Understanding what changed.** On a conventional system, "what changed recently on this host" requires looking at package manager logs, shell history, configuration management logs, and hoping nothing was changed manually. On a NixOS fleet, the answer is `git log` on the fleet repository. Every configuration change is there. If the change was not in git, it did not happen—or if it did, it will not survive a reboot.

**Rolling back.** If a deployment caused the incident, rollback is:
```sh
deploy-rs .#affected-host --profile-path /nix/var/nix/profiles/system-X-link
```
or on the host itself:
```sh
nixos-rebuild switch --rollback
```
The previous generation is still on disk (until garbage collection). Rollback takes seconds.

**Rebuilding a host.** If a host is compromised and needs to be wiped, rebuilding is booting a NixOS installer, running `nixos-install`, and pointing at the configuration from git. The new host is identical to the old one. No manual configuration, no "what was on there before."

## What is harder

**Live debugging.** NixOS's minimal default package set means some debugging tools are not installed. `strace`, `tcpdump`, `gdb` are not present by default. During an incident, you want them immediately.

Our solution: a `debug` module that installs a standard set of investigation tools, not enabled by default, that can be quickly deployed:

```nix
# modules/debug.nix - imported temporarily during incidents
{ pkgs, ... }: {
  environment.systemPackages = with pkgs; [
    strace ltrace
    tcpdump
    lsof
    gdb
    perf
    bpftools
    htop iotop
    netcat
    nmap
  ];
}
```

Add `./modules/debug.nix` to the host's imports, deploy, investigate, remove, deploy again.

**Urgency vs. process.** The deployment process (build → test → stage → production) adds time. During an active incident, that time is painful. We have a documented exception process for emergency hotfixes that compresses the staging window. We track how often we invoke it—frequent use is a signal that the normal process is too slow.

## The postmortem advantage

Because every configuration change is in git, postmortem timelines are easy to construct. "What changed in the 48 hours before the incident" is a `git log --since` command. Every configuration change has an author. This makes the postmortem conversation factual rather than speculative.

This is not a small thing. Postmortems without accurate timelines often produce wrong conclusions, which leads to fixes that do not address the actual problem.

## The thing we changed after our first incident

We now keep one NixOS generation more than the default on production hosts. By default, NixOS garbage collection keeps a configurable number of generations. We keep 10. This gives us more rollback options without significant disk cost.

```nix
nix.gc = {
  automatic = true;
  dates = "weekly";
  options = "--delete-older-than 60d";
};

# Keep at least 10 generations regardless of age
boot.loader.grub.configurationLimit = 10;
```
