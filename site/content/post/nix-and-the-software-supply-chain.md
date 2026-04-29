---
title: Nix and the Software Supply Chain
date: 2026-04-05T09:00:00.000Z
description: >-
  Supply chain attacks are now a mainstream threat. Nix's content-addressed
  store and hash-pinned inputs give you strong guarantees that other package
  managers cannot.
draft: true
---

Software supply chain attacks—SolarWinds, XZ Utils, the npm left-pad incident and its more malicious successors—have moved from theoretical concern to documented operational reality. Understanding what protection Nix offers (and where the limits are) is worth the time.

## What the Nix store gives you

Every package in the Nix store is identified by a hash of its inputs: source code, build dependencies, build script, and environment. The hash is content-addressed. If the inputs change, the hash changes, and it is a different package.

This means: if you pin a package to a specific hash and that hash still exists in the Nix store or on a binary cache, you are getting exactly what you pinned. You cannot accidentally receive a different package with the same version number—the hash would change.

## Flake lock files as a supply chain control

Every input in a `flake.lock` is pinned to a git commit hash. nixpkgs at `nixos-24.11` is not "whatever the latest commit on nixos-24.11 is"—it is a specific commit with a specific SHA256 hash. No silent updates.

When you run `nix flake update`, you are explicitly choosing to move to a new revision. That choice is recorded in git as a diff. You can review exactly what changed in nixpkgs between the old and new lock. This is not true of most other package managers.

## Binary cache trust

Nix can use binary caches (like cache.nixos.org) to download pre-built packages rather than building from source. This trades build time for trust: you are trusting that the binary cache serves packages that match the expected hashes.

The Nix binary cache signs packages with a cryptographic key. Your Nix configuration specifies which keys to trust:

```nix
nix.settings = {
  trusted-substituters = [
    "https://cache.nixos.org"
    "https://nix-community.cachix.org"
  ];
  trusted-public-keys = [
    "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY="
    "nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Kg="
  ];
};
```

If a binary cache serves a package that does not match the expected hash, Nix rejects it and falls back to building from source. This is a meaningful protection against cache poisoning.

## Where the limits are

Nix does not validate the security of the source code it builds. If nixpkgs pins a version of a library that has a backdoor, Nix will faithfully build and install that library. The XZ Utils backdoor would have affected NixOS users who had a package depending on the compromised xz version in their pinned nixpkgs. (In practice, the fast nixpkgs update cadence meant the backdoored version was removed from nixpkgs quickly—but it was in the pinned nixpkgs of some flakes during the window.)

Nix gives you: reproducibility, auditability of what changed, and protection against supply chain attacks that operate through modified downloads or binary substitution. It does not give you: protection against backdoors in the upstream source code you are building.

## Practical supply chain hygiene with Nix

- Review `flake.lock` diffs before merging update PRs—`nix flake metadata` shows you a summary of what changed
- Subscribe to nixpkgs security advisories
- Run `nix audit` or Trivy against your builds as part of CI
- For highly sensitive workloads, build from source rather than using the binary cache (disable substituters, or verify hashes against an independent build)
