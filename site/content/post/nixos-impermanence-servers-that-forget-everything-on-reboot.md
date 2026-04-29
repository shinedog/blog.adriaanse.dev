---
title: "NixOS Impermanence: Servers That Forget Everything on Reboot"
date: 2025-12-10T09:00:00.000Z
description: >-
  The impermanence pattern erases the root filesystem on every reboot and
  rebuilds from the NixOS configuration. Anything not explicitly declared is
  gone. It sounds extreme—but it enforces exactly the discipline managed IT
  requires.
draft: true
---

The NixOS impermanence pattern starts from a simple premise: if your configuration is fully declarative, you should not need anything on disk that is not declared. Anything that accumulates there is undeclared state—and undeclared state is the root of configuration drift.

## How it works

Using `tmpfs` on `/` (or the `impermanence` NixOS module with ZFS), the root filesystem is ephemeral. On every reboot, it is empty. NixOS builds the system from the configuration and populates it. Files that need to persist across reboots—SSH host keys, service data, logs—must be explicitly declared:

```nix
environment.persistence."/persist" = {
  hideMounts = true;
  directories = [
    "/var/lib/postgresql"
    "/var/lib/grafana"
    "/var/log"
    "/etc/ssh"
  ];
  files = [
    "/etc/machine-id"
  ];
};
```

Everything not in this list disappears on reboot.

## Why this matters operationally

The most common source of undeclared state we encounter when taking over existing infrastructure is things installed during incidents. An administrator installs a debugging tool during a 2am outage and never removes it. A config file gets edited directly on the host. A cron job gets added outside of configuration management.

With impermanence, none of this survives a reboot. The system at any point in time is exactly what the configuration says it is, plus whatever is explicitly persisted. There is no accumulated cruft.

## The discipline it enforces

Every service that needs persistent data must declare it. This sounds burdensome—it is actually useful documentation. The persistence declaration is a complete list of what each service needs to survive. When you are assessing a system for disaster recovery, that list tells you exactly what to back up.

## Where we use it

We enable impermanence on monitoring and VPN hosts—systems where we want extremely high confidence that the running state matches the declared configuration. We are more conservative with stateful application servers, where the cost of an undeclared-state incident is higher.

## Gotchas

If a service creates files outside its declared directories and those files are needed for correct operation, you will discover it on first reboot. The NixOS module documentation for most services tells you what to persist. For everything else: read the service's documentation, or run it once, note what it writes to disk, and add those paths.

SSH host key persistence is essential—without it, every reboot presents a new host key and all clients will reject the connection.
