---
title: MFA Enforcement for Small Teams Without an Enterprise Budget
date: 2026-03-24T09:00:00.000Z
description: >-
  Multi-factor authentication is the single highest-leverage security control
  for credential-based attacks. Here is how we enforce it across the services
  small organisations actually use, without requiring expensive identity platforms.
draft: true
---

Credential theft is the most common initial access vector in incidents affecting small organisations. It is also one of the most preventable. MFA stops the majority of credential-based attacks even when passwords are compromised.

The objection we hear most often: "MFA is complicated to set up." It is not, for the services that matter most.

## The services to prioritise

Not all services are equal. A compromised Slack account is recoverable. A compromised Microsoft 365 Global Admin account is a full breach. A compromised cloud provider root account can result in complete infrastructure loss.

MFA priority order:
1. Cloud provider root/admin accounts (AWS, GCP, Azure, Hetzner, etc.)
2. Microsoft 365 or Google Workspace admin accounts
3. DNS registrar accounts
4. Source code repositories (GitHub, GitLab, Forgejo)
5. Password manager master accounts
6. All user Microsoft 365 / Google Workspace accounts

Everything else is a lower priority. Do not let the breadth of the problem prevent you from starting with what matters most.

## What we enforce for the services we manage

For NixOS-managed services, we enforce MFA via SSH public key authentication—which is already phishing-resistant and credential-theft-resistant by design. There is no password to steal.

For web services accessed by client staff, the minimum bar is TOTP (Google Authenticator, Aegis on Android, or any TOTP app). This is not phishing-resistant, but it stops the majority of automated credential-stuffing attacks.

For the accounts listed above—cloud provider roots, email admin accounts—we require hardware keys (YubiKey or similar) where the service supports FIDO2/WebAuthn. FIDO2 is phishing-resistant: the key will not respond to a fake site.

## Practical enforcement without enterprise tools

**Microsoft 365 Conditional Access** (available on Microsoft 365 Business Premium and above): require MFA for all users, all sign-ins. This is a single policy change in the Entra ID portal. It takes 10 minutes to configure and covers every Microsoft 365 service.

**Google Workspace MFA**: under Security > 2-step verification, enforce 2SV for all users in the Admin Console. Enable the "Titan Security Keys" requirement for admin accounts.

**Passwordless SSH**: already covered by requiring public key authentication in our SSH module. No password, no brute force, no phishing vector.

**GitHub/Forgejo**: require 2FA organisation-wide. GitHub makes this a one-click organisation setting.

## The password manager question

If you enforce MFA but staff are reusing passwords, MFA is a speed bump. The combination that actually works: a team password manager (Bitwarden Teams is inexpensive and auditable) with MFA on the password manager itself.

We treat password manager adoption as a prerequisite to MFA enforcement. Enforcing MFA with weak, reused passwords just moves the attack to services that do not yet have MFA.

## Measuring coverage

We run quarterly checks:
- Enumerate all admin accounts in cloud providers and SaaS services
- Verify MFA is enabled on each
- Document which services do not support MFA (avoid new subscriptions to such services)

This is a spreadsheet, not a tool. It takes two hours per quarter. The alternative is discovering MFA gaps during an incident.
