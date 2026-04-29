---
title: "Operator Documentation: Keeping Runbooks Next to the Configuration"
date: 2026-02-20T09:00:00.000Z
description: >-
  Documentation that lives in a separate wiki drifts away from the system it
  describes. Keeping runbooks in the same repository as the configuration
  means the two stay in sync—or the reviewer catches the discrepancy.
draft: true
---

Infrastructure documentation has a shelf life. A runbook written when a system was set up is often inaccurate a year later. The system changes; the documentation does not. Or the documentation is updated but the system is not. Either way, the runbook is unreliable when you need it most—during an incident.

We keep runbooks in the same git repository as the NixOS configuration. This does not guarantee the documentation stays accurate, but it means changes to the system and changes to the documentation are reviewed together.

## Repository structure with documentation

```
flake.nix
flake.lock
hosts/
  monitoring/
    configuration.nix
    README.md          # host-specific runbook
  backup/
    configuration.nix
    README.md
modules/
  hardening.nix
  monitoring.nix
  backup.nix
docs/
  architecture.md     # fleet architecture overview
  onboarding.md       # new operator guide
  incident-response.md
  secret-rotation.md
  disaster-recovery.md
runbooks/
  backup-restore.md
  vpn-recovery.md
  host-replacement.md
  certificate-renewal.md
```

## What goes in a host README

The `hosts/monitoring/README.md` is the first thing a new operator reads about that host. It should answer:
- What does this host do?
- What services are running and what do they serve?
- What ports are open and why?
- What does this host depend on (other hosts, external services)?
- What depends on this host?
- How do you get to it? (VPN profile, SSH jump host?)
- What does recovery look like if it fails?

This is not a comprehensive operations guide—it is the context you need to work safely on the host.

## What goes in a runbook

Runbooks are step-by-step procedures for specific tasks: rotating a secret, replacing a failed host, restoring a backup, responding to a specific alert. The format we use:

```markdown
# Backup Restore Runbook

## When to use this
When a client needs to recover a file or database that has been deleted,
corrupted, or lost.

## Prerequisites
- Access to the management VPN
- SSH access to the backup host
- The agenix CLI installed

## Steps

### 1. Identify the backup to restore from
...

### 2. Mount the borg archive
...

## Verification
After completing the restore, verify:
- [ ] File/database accessible by the application
- [ ] Data appears complete and uncorrupted

## Notes
If the borg passphrase is needed and you do not have it decrypted:
`agenix -d secrets/borgbackup-passphrase.age`
```

The checklist at the end of the verification section is important. It is the difference between "I think it worked" and "I confirmed it worked."

## Keeping docs in sync

We add a documentation review to the pull request checklist:
- Does this change require updating any runbooks?
- Does this change require updating the affected host README?

The answer is often no. When the answer is yes, the reviewer checks that both the configuration and the documentation changed together.

This is not a perfect system. Documentation still gets stale. But it gets stale much more slowly when the reviewer has to explicitly consider whether a configuration change affects the docs.
