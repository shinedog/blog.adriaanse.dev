---
title: Nix Flake Templates for New Projects
date: 2026-03-17T09:00:00.000Z
description: >-
  Flake templates give every new project a consistent starting point: pinned
  toolchain, dev shell, CI config, and git hooks. Here is how we structure
  templates for the projects we commonly start.
draft: true
---

Every new project starts with the same decisions: which tools, which versions, how to run CI, what linting to enforce. Without a template, these decisions get made ad-hoc, producing inconsistent results across projects. With a flake template, they are made once and inherited.

## What a Nix flake template is

A flake template is a flake that exposes a `templates` output. `nix flake init -t github:myorg/templates#go` copies the template into the current directory. The template typically contains a `flake.nix` with a devshell and CI configuration, a `.envrc`, and any project-specific boilerplate.

## Our Go service template

```nix
# templates/go-service/flake.nix
{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";

  outputs = { self, nixpkgs }:
    let
      pkgs = nixpkgs.legacyPackages.x86_64-linux;
    in {
      devShells.x86_64-linux.default = pkgs.mkShell {
        packages = with pkgs; [
          go_1_23
          golangci-lint
          gotools         # goimports, godoc, etc.
          go-task         # Taskfile runner
          postgresql_16   # for integration tests
          goose           # database migrations
        ];

        shellHook = ''
          export CGO_ENABLED=0
          export GOPATH="$(pwd)/.gopath"
          echo "Go $(go version | cut -d' ' -f3) ready"
        '';
      };

      packages.x86_64-linux.default = pkgs.buildGoModule {
        pname = "service";
        version = "0.1.0";
        src = ./.;
        vendorHash = null; # set after first build
      };

      checks.x86_64-linux.lint = pkgs.runCommand "lint" {
        buildInputs = [ pkgs.go_1_23 pkgs.golangci-lint ];
      } ''
        cd ${./.}
        golangci-lint run ./...
        touch $out
      '';
    };
}
```

## The infrastructure template

For NixOS host configurations, our template pre-wires the standard modules:

```sh
nix flake init -t github:myorg/templates#nixos-fleet
```

This creates:
```
flake.nix              # with nixpkgs, agenix, deploy-rs inputs
flake.lock             # pre-populated lock
hosts/
  example/
    configuration.nix
    hardware-configuration.nix  # placeholder
modules/
  common.nix           # our standard hardening baseline
  README.md            # module documentation
secrets/
  secrets.nix          # agenix key mapping template
.forgejo/
  workflows/
    ci.yml             # build + test pipeline
.envrc                 # use flake
```

The first thing done with a new client infrastructure repository is `nix flake init -t github:myorg/templates#nixos-fleet`. Everything is set up. The only remaining work is filling in the specific host configuration and secrets.

## Pre-commit hooks

Templates include `.pre-commit-config.yaml` or equivalent hooks via `pre-commit-hooks.nix`:

```nix
checks.x86_64-linux.pre-commit = pre-commit-hooks.lib.x86_64-linux.run {
  src = ./.;
  hooks = {
    nixpkgs-fmt.enable = true;
    statix.enable = true;    # Nix anti-pattern linter
    deadnix.enable = true;   # Unused code detection
  };
};
```

These run on every commit and in CI. Code style and obvious errors are caught before review.

## Keeping templates current

Templates go stale. We run `nix flake update` on all templates monthly and commit the updated lock files. This keeps the pinned toolchain reasonably current without requiring manual attention for each project.
