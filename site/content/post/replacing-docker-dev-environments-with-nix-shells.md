---
title: Replacing Docker Dev Environments with Nix Shells
date: 2026-01-05T09:00:00.000Z
description: >-
  Docker is widely used for development environment isolation but carries
  significant overhead. Nix development shells give you reproducible, isolated
  environments with no daemon, no image management, and no container runtime.
draft: true
---

Development environment consistency is a real problem. "Works on my machine" is not a new complaint. Docker solved it for some teams by packaging the entire environment as a container image. Nix solves it differently—and for development workflows, usually better.

## What a Nix devshell is

A Nix development shell (`nix develop` or `nix-shell`) provides a shell environment with exactly the specified packages on `$PATH`, without modifying your system. When you exit the shell, your system is unchanged. Every developer on the team who runs `nix develop` gets the same environment, pinned to the same package versions.

```nix
# flake.nix
{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";

  outputs = { self, nixpkgs }: let
    pkgs = nixpkgs.legacyPackages.x86_64-linux;
  in {
    devShells.x86_64-linux.default = pkgs.mkShell {
      packages = with pkgs; [
        go_1_23
        golangci-lint
        postgresql_16
        redis
        just
        kubectl
        helm
      ];

      shellHook = ''
        export DATABASE_URL="postgresql://localhost/myapp_dev"
        export REDIS_URL="redis://localhost:6379"
      '';
    };
  };
}
```

Any developer who runs `nix develop` in this repository gets Go 1.23, the same linter, the same database tools—on Linux or macOS.

## Compared to Docker

Docker dev environments require:
- A running Docker daemon
- Pulling and storing image layers (GB of disk)
- Volume mount performance overhead on macOS
- Either running as root in the container or fiddling with user mapping
- An image rebuild whenever dependencies change

A Nix devshell requires:
- Nix installed (a one-time step)
- Running `nix develop` (packages are fetched on first use, cached after)

The resulting environment is native on your system—no virtualisation, no filesystem translation. A Nix-built PostgreSQL binary runs at full speed. File access is direct.

## direnv integration

With `direnv` and `nix-direnv`, the shell activates automatically when you enter the project directory:

```
# .envrc
use flake
```

Now the environment is active whenever you are in the project directory, in any terminal, without any manual step.

## For infrastructure-as-code repositories

For NixOS fleet repositories specifically, the devshell gives every operator the same version of:
- `deploy-rs`
- `agenix`
- `nixos-generators`
- `just` (for task automation)
- `nix` itself (pinned to a specific version)

No more "but I have a different version of deploy-rs installed." The repository defines the tools needed to work with it, and those tools are available to everyone.
