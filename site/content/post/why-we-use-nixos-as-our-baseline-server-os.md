---
title: Why We Use NixOS as Our Baseline Server OS
date: 2026-03-01T09:00:00.000Z
description: >-
  We standardised every server we manage on NixOS. Here is what that decision
  looks like two years in, and why we have not regretted it.
---

When a client asks us to take over management of their IT, the first thing we do after auditing the existing state is decide what the target platform looks like. For the last two years that answer has been NixOS on every server we control. This post explains why.

## The problem we were solving

Before standardising on NixOS we used a combination of Debian with Ansible. The setup worked, but it had a characteristic failure mode: *configuration drift*. An Ansible run might succeed on nine hosts and partially fail on the tenth. Over time, servers diverged. Re-running the same playbook three months later would produce different results because something had been changed manually, a package had been updated outside of the automation, or a service file had been tweaked during an incident.

Drift is not just an operational annoyance. It is a security problem. You cannot reason about the attack surface of a machine you cannot fully describe.

## What NixOS does differently

NixOS is a Linux distribution where the entire system configuration—packages, services, users, firewall rules, kernel parameters—is expressed in a single declarative specification. The configuration is stored in version control. When you change something, you change the specification and rebuild. There is no other way to make a permanent change.

This has two consequences that matter for small-business IT:

**Reproducibility.** Given the same configuration, you get the same system. A new server provisioned from the same spec is identical to the one it replaces. Rebuilding after an incident is a mechanical task, not an investigation.

**Auditability.** The entire configuration is text. You can `git log` it, review changes in pull requests, and understand precisely what changed between any two points in time. There is no equivalent for a Debian server touched by five different administrators over three years.

## The practical cost

NixOS has a steeper learning curve than Debian. The Nix language is unfamiliar. Module options require documentation-reading. The first few systems take longer to set up than they would with a conventional distribution.

Our honest assessment after two years: the upfront investment pays back within three to six months on any server you will manage for more than a year. The time we used to spend on "why is this server different from the others" debugging is gone. Incident recovery is faster. Patch cycles are predictable.

For clients, the benefit is a system they can hand back to another operator with a complete written description of what it is. No tribal knowledge required.

## What we use it for

We run NixOS on everything we manage directly: monitoring hosts, backup servers, VPN gateways, and application servers. Where clients have existing infrastructure we cannot immediately replace, we introduce NixOS at the edges and work inward.

The configuration for every host lives in a git repository that the client owns. If they ever move to a different operator, they take their configuration with them.

That is the point. Accountable, open, recoverable IT.
