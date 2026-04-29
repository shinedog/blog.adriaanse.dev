---
title: Managing a NixOS Fleet with deploy-rs
date: 2025-12-20T09:00:00.000Z
description: >-
  deploy-rs is a simple, correct deployment tool for NixOS: it builds on your
  machine, copies the closure, activates remotely, and rolls back automatically
  if activation fails. Here is how we use it.
draft: true
---

Once you have a multi-host NixOS fleet defined as a flake, you need a way to push configurations to hosts. `deploy-rs` is what we use.

## Why not nixos-rebuild --target-host?

`nixos-rebuild --target-host` is the built-in option. It works but has a significant gap: if activation fails, it leaves the host in a broken state with no automatic rollback.

`deploy-rs` adds:
- Automatic rollback if activation fails (the old configuration is restored)
- Configurable confirmation timeouts (if the deploying machine loses connectivity, the host rolls back)
- Parallel multi-host deployments
- Profile support for rolling out in stages

For production systems, automatic rollback is not optional.

## Flake integration

deploy-rs is added as a flake input and exposes a `deploy` output:

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    deploy-rs.url = "github:serokell/deploy-rs";
  };

  outputs = { self, nixpkgs, deploy-rs }: {
    nixosConfigurations = { ... };

    deploy.nodes = {
      monitoring = {
        hostname = "monitoring.internal";
        profiles.system = {
          user = "root";
          path = deploy-rs.lib.x86_64-linux.activate.nixos
            self.nixosConfigurations.monitoring;
        };
      };

      backup = {
        hostname = "backup.internal";
        profiles.system = {
          user = "root";
          path = deploy-rs.lib.x86_64-linux.activate.nixos
            self.nixosConfigurations.backup;
        };
      };
    };

    checks = builtins.mapAttrs
      (system: deployLib: deployLib.deployChecks self.deploy)
      deploy-rs.lib;
  };
}
```

## Deployment workflow

```sh
# Deploy to all hosts in parallel
deploy .

# Deploy to a single host
deploy .#monitoring

# Dry-run: build and check, do not activate
deploy --dry-activate .#monitoring
```

The `--dry-activate` flag is our pre-flight check. It builds the configuration closure and verifies it can be activated without actually applying it. We run this in CI on every pull request.

## Rollback behaviour

By default, deploy-rs waits 30 seconds after activation for the deploying machine to "confirm" the deployment. Confirmation means the activating process exits successfully and the host is reachable. If confirmation does not arrive—because the new configuration broke networking, for example—the host rolls back to the previous generation automatically.

We set the confirmation timeout to 60 seconds for most hosts and 120 seconds for the VPN gateway, where a failed activation means we temporarily lose the management tunnel.

## What deploy-rs does not do

It does not manage secrets (that is agenix's job). It does not orchestrate rolling deployments across groups of hosts—for that you would need additional tooling. For a small fleet of five to twenty hosts, the parallel deployment and automatic rollback are all you need.
