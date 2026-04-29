---
title: "ZFS on NixOS: Reliable Storage Architecture"
date: 2026-01-15T09:00:00.000Z
description: >-
  ZFS gives you checksumming, copy-on-write snapshots, and built-in scrubbing.
  On NixOS, the entire pool configuration is declarative. Here is how we
  structure storage for small-business servers.
draft: true
---

Most servers we take over have storage configured as ext4 or XFS on top of LVM, provisioned manually at install time, with no snapshot capability and no data integrity verification. When something goes wrong—and it does—the options are limited.

ZFS changes the economics of reliable storage. On NixOS, configuring it is declarative.

## Why ZFS for small-business servers

**Checksumming.** ZFS checksums every block. Silent data corruption—writes that appear to succeed but produce incorrect data—is detected automatically. On conventional filesystems, you can silently accumulate corruption for months before you notice (usually when you need a backup). With ZFS, corruption is detected at read time and can be repaired from a mirror.

**Snapshots.** ZFS snapshots are instantaneous and space-efficient. Taking a snapshot before a deployment costs nothing. Rolling back from a bad deployment is seconds. This changes how you think about maintenance windows.

**Scrubbing.** ZFS can verify the integrity of all data on the pool and repair any errors found (if you have redundancy). We run monthly scrubs. A server that passes a monthly scrub is a server whose data is likely intact.

## NixOS configuration

```nix
boot.supportedFilesystems = [ "zfs" ];
boot.zfs.devNodes = "/dev/disk/by-id";

# Required by ZFS—must be unique per host
networking.hostId = lib.mkDefault
  (builtins.substring 0 8 (builtins.hashString "md5" config.networking.hostName));

services.zfs = {
  autoSnapshot = {
    enable = true;
    frequent = 4;
    hourly = 24;
    daily = 7;
    weekly = 4;
    monthly = 12;
  };

  autoScrub = {
    enable = true;
    interval = "monthly";
  };
};
```

## Pool layout for a backup server

For a dedicated backup host with two drives:

```sh
# Create a mirrored pool
zpool create -o ashift=12 \
  -O compression=lz4 \
  -O atime=off \
  -O xattr=sa \
  -O dnodesize=auto \
  backup mirror \
  /dev/disk/by-id/ata-disk1 \
  /dev/disk/by-id/ata-disk2
```

Mirror means: one drive can fail and the data is intact. Combined with monthly scrubbing, you have a reasonable confidence level in the data's integrity.

## Dataset structure

We structure datasets by retention requirement:

```sh
zfs create backup/clients           # client backups (retained 1 year)
zfs create backup/monitoring        # Prometheus data (retained 90 days)
zfs create backup/logs              # centralised logs (retained 180 days)
```

Each dataset can have its own snapshot schedule and compression settings. This is cleaner than managing retention at the application level.

## Monitoring pool health

We export ZFS pool status to Prometheus via `zfs-exporter` and alert on:
- Pool state != ONLINE
- Scrub errors > 0
- Checksum errors increasing

A non-ONLINE pool state gets an immediate alert. Increasing checksum errors are a warning—they indicate drive health is degrading before it reaches a failure state.
