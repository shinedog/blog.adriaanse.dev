---
title: "From Ansible to NixOS: Why We Made the Switch"
date: 2026-01-12T09:00:00.000Z
description: >-
  Ansible is a fine tool. It is also fundamentally imperative—it describes
  actions, not state. After years of managing drift in Ansible-managed
  infrastructure, we switched to NixOS. Here is the honest comparison.
draft: true
---

We used Ansible for years. We were good at it. We understood its idioms, managed idempotency carefully, and ran lint on every playbook. We still moved away from it. Here is why.

## What Ansible does well

Ansible is excellent for:
- Executing ordered sequences of actions on existing systems
- Managing heterogeneous infrastructure (different OS versions, distributions)
- Orchestrating multi-step processes (deploy application, wait for health check, update load balancer)
- Teams that are not willing to adopt NixOS

It is genuinely good at these things. If you are managing a mix of Ubuntu, RHEL, and Windows servers, Ansible is probably the right tool. We are not arguing otherwise.

## Where Ansible accumulates problems

Ansible playbooks describe actions to take, not the desired state of the system. Even with careful idempotency, some divergence is nearly inevitable over time:

**Package residue.** Packages installed during an Ansible run and later removed from the playbook are not uninstalled unless you write an explicit uninstall task—which most people do not. After a year, servers have packages installed by old plays that no longer exist in the repository.

**File accumulation.** Configuration files created by old plays and never cleaned up. Cron jobs added and later removed from playbooks that still run on the target.

**Partial run state.** An Ansible run that fails halfway leaves the target in an intermediate state. The next run might succeed without correcting the partial state from the previous failure.

**Testing.** Testing Ansible roles against real systems is slow. Testing against mock systems (Molecule) is incomplete—the mock is rarely a perfect replica.

## What NixOS changes

NixOS configurations declare the complete state of a system. There is no "packages installed by an old playbook." Every package on the system is listed in the configuration. Packages removed from the configuration are garbage-collected. Files not declared are not present.

The system is the configuration. Always.

## The honest tradeoffs

NixOS requires:
- Learning the Nix language (a real investment—expect weeks to months)
- NixOS-compatible services (most common services have NixOS modules; obscure ones may not)
- The target OS to be NixOS (you cannot apply NixOS configurations to existing Ubuntu servers)

If you are managing existing Debian infrastructure you cannot replace, Ansible is the pragmatic choice. If you are provisioning new servers and willing to invest in the Nix learning curve, the long-term operational cost of NixOS is lower.

We made the switch when we took on a new client with a greenfield infrastructure requirement. We have not regretted it. We do not recommend it uncritically.
