---
title: "NixOS for Small Business: Getting to Production"
date: 2025-12-15T09:00:00.000Z
description: >-
  The learning curve is real, but the path from zero to a production NixOS
  server is shorter than it looks. Here is a practical sequence that works for
  small-business IT.
draft: true
---

Most introductions to NixOS start with the Nix language, the store, the derivation model, lazy evaluation, and a dozen other concepts before you can install anything. This is not that.

Here is the path we take when bringing a new client onto NixOS infrastructure.

## Step 1: One server, one service

Do not start by migrating an existing complex system. Start with a new server running a single simple service: a monitoring host, a VPN gateway, a DNS resolver. Something self-contained where a mistake does not affect users.

A minimal NixOS configuration for a monitoring host:

```nix
{ config, pkgs, ... }: {
  system.stateVersion = "24.11";

  # Basic networking
  networking.hostName = "monitoring";
  networking.firewall.allowedTCPPorts = [ 22 9090 3000 ];

  # SSH access
  services.openssh.enable = true;
  users.users.admin = {
    isNormalUser = true;
    extraGroups = [ "wheel" ];
    openssh.authorizedKeys.keys = [ "ssh-ed25519 AAAA... your key" ];
  };
  security.sudo.wheelNeedsPassword = false;

  # The actual service
  services.prometheus.enable = true;
  services.grafana.enable = true;
}
```

Install it. Run it for two weeks. Read the NixOS option documentation for the services you are using. You will learn more in those two weeks than from any tutorial.

## Step 2: Move the configuration into a flake

Once you have a working configuration on one host, move it into a flake structure. This is the point where you add a `flake.nix`, introduce the lock file, and start version-controlling the configuration.

The flake structure forces good habits: pinned inputs, reproducible builds, a single source of truth for the configuration.

## Step 3: Add secrets management

Before adding a second host, set up agenix. Re-encrypting secrets for a new host after the fact is more work than doing it upfront. The discipline of "every secret is an agenix-managed file" is worth establishing early.

## Step 4: Add a second host

The second host is where the value of the declarative approach becomes concrete. You have a `modules/common.nix` that applies to both hosts: SSH hardening, monitoring agent, firewall defaults. Adding the second host is adding a new entry to `flake.nix` and a new directory under `hosts/`.

Compare this to the second Ansible-managed host: another playbook, another inventory entry, another round of "did I apply all the roles."

## Step 5: Add deploy-rs and CI

Once you have two hosts, set up deploy-rs and CI. The investment pays off immediately: deployments are safe (automatic rollback), and configuration changes are tested before they reach production.

## Realistic timeline

For an operator familiar with Linux but new to Nix:
- First production NixOS host: 2-4 weeks from starting to learn Nix
- Fleet of 3-5 hosts with full tooling (flakes, agenix, deploy-rs, CI): 2-3 months

The learning investment is front-loaded. After the initial curve, adding new hosts and services is fast.

## The most common mistake

Trying to learn Nix and NixOS at the same time as migrating production infrastructure. Learn on throwaway hosts. The cost of breaking a staging VPS is zero. The cost of breaking a client's production server is not.
