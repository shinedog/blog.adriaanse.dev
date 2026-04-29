---
title: "Audit Logging on NixOS: auditd Configuration"
date: 2026-02-10T09:00:00.000Z
description: >-
  auditd gives you a kernel-level record of system calls, file access, and
  privilege escalation. On NixOS it is trivially enabled and its rules are
  version-controlled alongside everything else.
draft: true
---

Audit logs are what you reach for during an incident when you need to answer questions like: who ran this command, when did this file change, which process opened this connection. On a system without auditd, those questions often have no answer. With auditd, they do.

## Enabling auditd in NixOS

```nix
security.auditd.enable = true;
security.audit = {
  enable = true;
  failureMode = "printk"; # log failures rather than panic
  rules = [
    # Log all execve syscalls (command execution)
    "-a always,exit -F arch=b64 -S execve -k exec"
    "-a always,exit -F arch=b32 -S execve -k exec"

    # Log privileged commands
    "-a always,exit -F path=/usr/bin/sudo -F perm=x -k privileged"
    "-a always,exit -F path=/bin/su -F perm=x -k privileged"

    # Log changes to authentication-related files
    "-w /etc/passwd -p wa -k identity"
    "-w /etc/shadow -p wa -k identity"
    "-w /etc/group -p wa -k identity"
    "-w /etc/sudoers -p wa -k identity"
    "-w /etc/sudoers.d/ -p wa -k identity"

    # Log SSH authorised key modifications
    "-w /root/.ssh -p wa -k ssh_keys"

    # Log cron changes
    "-w /etc/cron.d/ -p wa -k cron"
    "-w /var/spool/cron/ -p wa -k cron"

    # Log network configuration changes
    "-a always,exit -F arch=b64 -S sethostname -S setdomainname -k network_modifications"

    # Log kernel module loading
    "-w /sbin/insmod -p x -k modules"
    "-w /sbin/rmmod -p x -k modules"
    "-a always,exit -F arch=b64 -S init_module -S delete_module -k modules"

    # Make the audit configuration immutable until reboot
    "-e 2"
  ];
};
```

The `-e 2` rule at the end makes the audit configuration immutable until the next reboot. An attacker who gains root cannot disable auditing without rebooting (which is itself an auditable event, and often alertable via monitoring).

## Forwarding audit logs

auditd writes to `/var/log/audit/audit.log`. For incident response, you need these logs to be off-host—a compromised server's local logs cannot be trusted.

We forward to a centralised log host using `auditd`'s audisp remote plugin:

```nix
services.auditd.extraConfig = ''
  name_format = HOSTNAME
  log_format = ENRICHED
'';

# audisp-remote configuration
environment.etc."audit/audisp-remote.conf".text = ''
  remote_server = log-collector.internal
  port = 60
  transport = tls
  tls_client_cert = /etc/audit/client.crt
  tls_client_key = /etc/audit/client.key
  tls_ca_cert = /etc/audit/ca.crt
'';
```

The log collector is the only host in the fleet that can write to the logging destination. Application servers can push to it but not delete from it.

## Making sense of audit logs

Raw audit log format is verbose and cryptic. `ausearch` and `aureport` are the standard tools:

```sh
# All execve events in the last hour
ausearch -sc execve --start recent

# All sudo use
ausearch -k privileged

# Summary of activity
aureport --summary

# Failed login attempts
aureport --auth --failed
```

For ongoing analysis we feed audit logs into a SIEM (Loki + Grafana for small deployments, or Opensearch for anything larger). The NixOS auditd configuration is the source; the SIEM is just the query interface.

## What to alert on

We alert on:
- Any modification to `/etc/passwd`, `/etc/shadow`, `/etc/sudoers`
- `insmod` or `rmmod` on production hosts
- `execve` of `/bin/su` or `/usr/bin/sudo` outside business hours
- SSH authorised key file modifications

Everything else goes to the log for investigation if needed, but does not page anyone.
