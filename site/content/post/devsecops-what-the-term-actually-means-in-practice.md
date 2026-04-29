---
title: "DevSecOps: What the Term Actually Means in Practice"
date: 2026-01-25T09:00:00.000Z
description: >-
  DevSecOps is widely used and widely misunderstood. Here is what it means
  when applied to small-team infrastructure, stripped of the vendor marketing.
draft: true
---

"DevSecOps" appears in every cloud vendor's marketing and every compliance framework's recommended practices. It also means genuinely different things to different people. Here is what it means when we apply it to small-team managed IT.

## The core idea

The original insight from DevOps is: if you separate development from operations, you get silos, handoffs, and friction. Closing that gap—shared tools, shared visibility, shared responsibility for production—makes systems more reliable and deployments faster.

DevSecOps adds: if you also separate security from both development and operations, you get security that is bolted on at the end, hard to audit, and easy to skip under schedule pressure. Closing that gap means security controls are built into the delivery pipeline rather than reviewed at the end.

For infrastructure work specifically, DevSecOps in practice looks like:
- Security configuration is code (not a document, not a checklist, not a one-time task)
- Security controls are tested in CI (not audited quarterly)
- Changes to security-relevant configuration go through the same review process as any other change
- Security is a property of the running system, not a project that completes

## What this looks like with NixOS

When security hardening is a NixOS module, it is automatically:
- Version-controlled (every change has a git log entry)
- Reviewed (changes go through pull request review)
- Tested (CI builds the configuration and runs the test suite)
- Applied (every host that imports the module gets the hardening, every time)

This is not a DevSecOps tool or framework. It is the natural outcome of managing infrastructure declaratively.

## Where small teams cut corners (and why not to)

The pressure to skip security process comes from time, not indifference. A 5-person team managing 20-person organisation IT does not have a dedicated security person. The security controls need to be lightweight enough to maintain.

Our rule: if a security control requires a human action to apply it every time a change is made, it will eventually be skipped. Automate the controls that are always-on and always-required. Reserve human attention for the decisions that actually require judgment.

Examples of what we automate:
- SSH hardening (NixOS module, applied to every host)
- Firewall rules (NixOS configuration, version-controlled)
- Patch cycles (weekly flake update, reviewed diff, staged rollout)
- Secret rotation reminders (calendar reminders, not trust that someone will remember)

Examples of what requires human judgment:
- Whether a new service should be permitted through the firewall
- Whether a CVE in a dependency is actually exploitable given the deployment context
- Whether a security tradeoff (performance vs. encryption) is acceptable for this client

## The compliance framing

Most compliance frameworks want evidence that security controls exist and are applied. In a declarative infrastructure setup, that evidence is the git repository: every control, every change, every review. An audit of NixOS-managed infrastructure is largely an exercise in reading the git history.

This is a better answer than "we have a policy document" and "we run an annual checklist." The document might not match reality. The git history is reality.
