---
title: "Nix Flakes: Reproducible Infrastructure in Practice"
date: 2026-03-15T09:00:00.000Z
description: >-
  Flakes pin every dependency—including NixOS itself—to an exact hash. Here is
  how we structure our fleet repository and what that gives us in practice.
---

The most common question we get from engineers evaluating NixOS is: "how do you actually manage multiple hosts?" The answer is Nix flakes.

## What a flake is

A flake is a Nix project with a standardised interface. It takes a set of *inputs* (other flakes, pinned to exact revisions) and produces a set of *outputs* (NixOS system configurations, packages, development shells, etc.).

The key property is the `flake.lock` file. Like `package-lock.json` or `Cargo.lock`, it records the exact revision of every input. When you evaluate a flake, you get the same result on every machine, at any point in time, as long as the lock file has not changed.

For infrastructure this means: if you deploy a configuration today and redeploy from the same commit six months from now, you get the same software. There are no surprise upgrades.

## How we structure our fleet repository

A typical client repository looks like this:

```
flake.nix
flake.lock
hosts/
  monitoring/
    configuration.nix
    hardware-configuration.nix
  backup/
    configuration.nix
    hardware-configuration.nix
modules/
  common.nix        # hardening, audit, SSH config applied to all hosts
  monitoring.nix    # Prometheus, Grafana, Alertmanager
  backup.nix        # borgbackup jobs and retention
  wireguard.nix     # VPN gateway
secrets/            # agenix-encrypted secrets
```

The `flake.nix` defines all hosts:

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    agenix.url = "github:ryantm/agenix";
  };

  outputs = { self, nixpkgs, agenix }: {
    nixosConfigurations = {
      monitoring = nixpkgs.lib.nixosSystem {
        system = "x86_64-linux";
        modules = [
          ./hosts/monitoring/configuration.nix
          ./modules/common.nix
          ./modules/monitoring.nix
          agenix.nixosModules.default
        ];
      };
    };
  };
}
```

## Updating the fleet

Updating all hosts to a new NixOS release is a two-step process:

1. `nix flake update` — this updates `flake.lock` to the latest revision of every input
2. Commit the updated lock file and deploy

That is it. There is no per-host package management. Every host gets the same packages at the same versions, defined once. We can review the exact diff of what changed in nixpkgs between the old and new lock before deploying.

## Why this matters for security patching

When a critical CVE is published—say, a kernel vulnerability—we can update the nixpkgs input, build the new configuration, test it on one host, and roll it out across every host in the fleet within a consistent time window. No host is accidentally missed because it was provisioned differently three years ago.

The lock file history is also an audit trail. We can look at any past deployment and know exactly which version of every package was running.

## The tradeoff

Flakes require some discipline. The lock file must be committed—if it is gitignored, you lose reproducibility. Updating regularly (we do it weekly) means you catch small changes continuously rather than big upgrades infrequently. Some teams find the cadence uncomfortable at first.

Our view: weekly updates with tested, reviewed lock file diffs are far less risky than quarterly "big bang" updates to a system you cannot fully describe.
