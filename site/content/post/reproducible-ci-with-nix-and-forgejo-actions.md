---
title: Reproducible CI with Nix and Forgejo Actions
date: 2026-04-08T09:00:00.000Z
description: >-
  Running CI for a NixOS fleet means building and testing configurations before
  they reach production. Here is how we wire up Forgejo Actions with Nix to
  get fast, reproducible pipelines without proprietary infrastructure.
draft: true
---

Our fleet repository runs its own CI using Forgejo (a Gitea fork) with Forgejo Actions. The CI pipeline builds every host configuration, runs the NixOS test suite, and runs `deploy --dry-activate` against all hosts on every pull request. Nothing reaches production without passing CI.

## Why self-hosted

We use Forgejo rather than GitHub Actions or GitLab CI because:
- The fleet configuration contains details about internal network topology
- No dependency on a third-party CI service
- Forgejo runs on NixOS—the CI infrastructure is itself managed by the same fleet configuration

The Forgejo host is a lightweight NixOS VM with two runner services.

## Forgejo configuration in NixOS

```nix
services.forgejo = {
  enable = true;
  settings = {
    server = {
      DOMAIN = "git.internal";
      ROOT_URL = "https://git.internal/";
      HTTP_PORT = 3000;
    };
    service.DISABLE_REGISTRATION = true;
  };
};

# Nix-aware runner
services.gitea-actions-runner.instances.main = {
  enable = true;
  url = "https://git.internal";
  tokenFile = config.age.secrets.forgejoRunnerToken.path;
  name = "nix-runner";
  labels = [ "nix:docker://nixos/nix" ];
};
```

## Pipeline definition

```yaml
# .forgejo/workflows/ci.yml
name: CI

on:
  pull_request:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: nix
    steps:
      - uses: actions/checkout@v4

      - name: Install Nix
        uses: cachix/install-nix-action@v26
        with:
          extra_nix_config: |
            experimental-features = nix-command flakes

      - name: Check flake
        run: nix flake check --no-build

      - name: Build all host configurations
        run: |
          for host in monitoring backup gateway; do
            echo "Building $host..."
            nix build .#nixosConfigurations.$host.config.system.build.toplevel
          done

      - name: Dry-activate all hosts
        if: github.ref == 'refs/heads/main'
        run: deploy --dry-activate .
        env:
          SSH_AUTH_SOCK: /run/ssh-agent.sock

  test:
    runs-on: nix
    steps:
      - uses: actions/checkout@v4
      - name: Run NixOS tests
        run: nix build .#checks.x86_64-linux.ssh-hardening
```

## Caching builds

NixOS configuration builds are expensive (10-30 minutes for a full rebuild without cache). We use Cachix to share build outputs between CI runs:

```yaml
- name: Setup Cachix
  uses: cachix/cachix-action@v14
  with:
    name: our-fleet
    authToken: ${{ secrets.CACHIX_AUTH_TOKEN }}
```

After the first build, subsequent builds that use the same nixpkgs revision complete in under 2 minutes—they just download the pre-built derivations from the cache.

## The deploy gate

On merges to `main`, the pipeline runs `deploy --dry-activate` against all production hosts over the WireGuard VPN. This is a real connection to real hosts—it builds the configuration remotely and verifies activation would succeed. If any host is unreachable or would fail activation, the pipeline fails.

This is the last check before a human runs `deploy .`. If CI passes, deployment is low-risk. If CI fails, we investigate before touching production.
