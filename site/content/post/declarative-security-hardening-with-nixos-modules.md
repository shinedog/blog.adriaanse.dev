---
title: Declarative Security Hardening with NixOS Modules
date: 2026-04-01T09:00:00.000Z
description: >-
  Security hardening is usually a checklist applied manually and forgotten.
  With NixOS modules it becomes a reusable, version-controlled baseline applied
  to every host automatically.
---

Every server we manage gets the same hardening baseline. Not because we run the same script at build time—because the hardening is expressed as a NixOS module applied to every host configuration in the fleet.

Here is what that module looks like and why we structure it this way.

## The problem with manual hardening

CIS benchmarks and similar hardening guides give you a checklist. You apply it to a server. Six months later you provision a new server and someone forgets step 14. Or a patch cycle overwrites a configuration file you modified. Or an incident response leaves a firewall rule open.

The fundamental issue: hardening applied to a running system is state. State drifts.

## Hardening as a module

In NixOS, a module is a function that returns configuration. Any host that imports the module gets all of that configuration, always, on every rebuild.

Our `modules/hardening.nix` covers:

```nix
{ config, pkgs, lib, ... }: {

  # Kernel hardening
  boot.kernelParams = [
    "slab_nomerge"
    "slub_debug=FZP"
    "page_alloc.shuffle=1"
    "pti=on"
    "vsyscall=none"
    "debugfs=off"
    "oops=panic"
    "module.sig_enforce=1"
    "lockdown=confidentiality"
    "mce=0"
    "quiet"
    "loglevel=0"
  ];

  boot.kernel.sysctl = {
    # Network hardening
    "net.ipv4.conf.all.rp_filter" = 1;
    "net.ipv4.conf.default.rp_filter" = 1;
    "net.ipv4.conf.all.accept_source_route" = 0;
    "net.ipv4.conf.all.send_redirects" = 0;
    "net.ipv4.conf.all.accept_redirects" = 0;
    "net.ipv4.icmp_echo_ignore_broadcasts" = 1;
    "net.ipv4.tcp_syncookies" = 1;
    # Kernel hardening
    "kernel.kptr_restrict" = 2;
    "kernel.dmesg_restrict" = 1;
    "kernel.perf_event_paranoid" = 3;
    "kernel.unprivileged_bpf_disabled" = 1;
    "net.core.bpf_jit_harden" = 2;
    "kernel.yama.ptrace_scope" = 2;
  };

  # SSH hardening
  services.openssh = {
    enable = true;
    settings = {
      PasswordAuthentication = false;
      PermitRootLogin = "no";
      KbdInteractiveAuthentication = false;
      AllowAgentForwarding = false;
      AllowTcpForwarding = false;
      X11Forwarding = false;
      MaxAuthTries = 3;
      LoginGraceTime = 30;
    };
    extraConfig = ''
      AllowGroups wheel
    '';
  };

  # Minimal package surface
  environment.defaultPackages = lib.mkForce [];

  # Audit daemon
  security.auditd.enable = true;
  security.audit = {
    enable = true;
    rules = [
      "-a always,exit -F arch=b64 -S execve"
      "-w /etc/passwd -p wa"
      "-w /etc/shadow -p wa"
      "-w /etc/sudoers -p wa"
    ];
  };

  # Restrict su to wheel
  security.pam.services.su.requireWheel = true;
}
```

## What this gives you

Every host that imports `./modules/hardening.nix` gets all of this. No checklist. No drift. If we improve the baseline—add a new sysctl, tighten SSH further—we update the module, commit, and the change applies to the entire fleet on the next deployment cycle.

The configuration is text, so it can be reviewed in a pull request. Changes to hardening parameters show up in `git diff` like any other change.

## Layering on top

The base hardening module applies everywhere. Service-specific modules layer additional configuration on top. A web server module might open port 443. A monitoring host module might allow Prometheus scraping. The base hardening module is never loosened—additional modules only add permissions they need.

This is defence in depth: the minimal surface is the default, and additions require explicit justification.

## Testing it

NixOS has a first-class testing framework that lets you boot a VM from a configuration and run assertions. We have a test that builds the hardening module in a VM and checks that specific SSH options are present, that auditd is running, and that `PasswordAuthentication` is off. It runs in CI on every change to `modules/hardening.nix`.

That is something you cannot do with an Ansible playbook applied to a real server.
