---
title: What We Look For When Inheriting Infrastructure
date: 2026-04-12T09:00:00.000Z
description: >-
  When we take over management of an existing system, we do a structured
  assessment before touching anything. Here is what we look for and what the
  findings tell us.
draft: true
---

Most of the infrastructure we manage was not built for us. Typically a new client has been managing their own systems, using a break-fix IT provider, or running on systems set up by a developer years ago. The state of these systems varies significantly.

We do a structured assessment before making any changes. Here is what it covers and what we do with the findings.

## What we assess

**Authentication and access control**
- Who has root/admin access, and do those people still work here?
- Are shared passwords in use? On servers, on SaaS services, on cloud consoles?
- Is MFA enforced on the services that matter (cloud consoles, email admin, DNS)?
- Are SSH host keys present and known? Are they stored anywhere we can trust?
- When was the last time credentials were rotated?

**Backup and recovery**
- Are backups running? Show me the logs.
- Are backups tested? When was the last restore tested?
- Where do backups go? Can the system being backed up delete them?
- What is the recovery time objective? Has it ever been tested?

**Patch status**
- When were packages last updated?
- Is there any automated patching or alerting for CVEs?
- Are there services with known unpatched vulnerabilities?

**Monitoring**
- Is anything monitored? What happens when something fails?
- Are certificate expirations tracked?
- Is there disk space alerting?

**Configuration management**
- Is there any documentation of how the systems are configured?
- Were systems configured manually or with automation?
- If a server failed tomorrow, how long would it take to rebuild it? Does anyone know how?

## What the findings tell us

**High severity findings** (address within weeks):
- Shared passwords on critical systems
- No MFA on cloud console or email admin accounts
- No functional backups, or backups that cannot be restored
- Servers with known critical CVEs and no patching plan
- Former employee access not revoked

**Medium severity findings** (address within the first quarter):
- Packages significantly out of date
- No monitoring of any kind
- Configuration entirely undocumented
- Long-lived SSH keys with no rotation history

**Findings that inform the rebuild plan**:
- Everything manually configured with no documentation → plan a declarative rebuild
- Backup destination writable by the source → move to write-once backup target
- All servers on one cloud provider root account → separate access by function

## What we do not do

We do not make changes to production systems until the assessment is complete. The risk of breaking something that is working—even something held together with string—is real. Understanding before acting.

We also do not use the assessment as an opportunity to sell unnecessary work. Some clients have manual, undocumented systems that are nonetheless reliable and well-understood by the people who run them. "Undocumented" is a risk, not a catastrophe. We document the risk and address it in proportion to its actual likelihood and impact.
