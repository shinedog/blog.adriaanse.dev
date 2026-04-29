---
title: "Backup Strategy on NixOS: borgbackup and ZFS"
date: 2026-04-22T09:00:00.000Z
description: >-
  A backup strategy that has not been tested is not a backup strategy. Here is
  how we configure borgbackup and ZFS on NixOS, and how we verify restores
  automatically.
---

Most small organisations have backups in some form. Almost none of them test restores regularly. The gap between "we have backups" and "we can recover from this incident" is a restore test, and that test almost never happens until it is urgent.

Our backup setup on NixOS is designed to make restore verification automatic and cheap.

## The stack

We use two complementary tools:

- **ZFS snapshots** for fast local point-in-time recovery. Snapshotting is nearly instant, and rolling back a dataset is a seconds-long operation.
- **borgbackup** for off-site encrypted backups. Borg deduplicates, compresses, and encrypts at the client side. Backups go to a separate host (or cloud storage) that application servers cannot write to, only push to.

## ZFS configuration in NixOS

```nix
boot.supportedFilesystems = [ "zfs" ];
boot.zfs.devNodes = "/dev/disk/by-id";
networking.hostId = "deadbeef"; # required by ZFS, must be unique per host

services.zfs.autoSnapshot = {
  enable = true;
  frequent = 4;   # 15-minute snapshots, keep 4
  hourly = 24;    # hourly, keep 24
  daily = 7;      # daily, keep 7
  weekly = 4;     # weekly, keep 4
  monthly = 12;   # monthly, keep 12
};

services.zfs.autoScrub = {
  enable = true;
  interval = "monthly";
};
```

This gives you a dense snapshot history for the first 24 hours—useful for recovering a file deleted an hour ago—and sparser coverage going back a year.

## borgbackup configuration in NixOS

The NixOS borgbackup module is comprehensive. A typical configuration:

```nix
services.borgbackup.jobs.main = {
  paths = [ "/var/lib" "/etc" "/home" ];
  exclude = [ "/var/lib/docker/overlay2" ];

  repo = "borg@backup-host:/backups/this-host";
  encryption = {
    mode = "repokey-blake2";
    passCommand = "cat ${config.age.secrets.borgPassphrase.path}";
  };

  compression = "auto,zstd";
  startAt = "02:30";

  prune.keep = {
    daily = 7;
    weekly = 4;
    monthly = 6;
  };

  postHook = ''
    if [ "$exitStatus" -ne 0 ]; then
      ${pkgs.curl}/bin/curl -fsS \
        "https://monitoring/alert?host=$(hostname)&job=borgbackup&status=failed"
    else
      ${pkgs.curl}/bin/curl -fsS \
        "https://monitoring/heartbeat?host=$(hostname)&job=borgbackup"
    fi
  '';
};
```

The `postHook` sends a heartbeat to the monitoring system on success. If a backup fails—or simply does not run—the monitoring system alerts. This is a dead man's switch: we are not alerted on failure, we are alerted on absence of success. The distinction matters.

## Automated restore testing

Once a week, a systemd timer on the backup host runs a restore test:

1. Mount the latest borg archive read-only
2. Attempt to read a set of known files (database dumps, configuration files) and verify their checksums
3. Report pass/fail to the monitoring system

The restore test does not recover a full system—that would be expensive. It verifies that the archive is readable and that the expected content is there. Full restore drills happen quarterly, manually, with a record kept.

## What we do not do

We do not backup to the same host we are protecting. We do not use backups that the application server can delete (read-only repository access at the destination). We do not accept "backup job completed" as evidence of a valid backup without a restore test.

These three rules eliminate the most common failure modes we have seen in inherited infrastructure.
