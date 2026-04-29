---
title: The Case Against Proprietary Network Appliances
date: 2026-03-10T09:00:00.000Z
description: >-
  Firewalls, switches, and routers from proprietary vendors are the default
  recommendation for small-business IT. They are also opaque, hard to recover,
  and create vendor dependency. Here is why we have moved away from them.
draft: true
---

The conventional recommendation for small-business network infrastructure is a Fortinet or Ubiquiti firewall, a managed switch, and a wireless controller. The appliance vendor provides support, firmware updates, and a GUI. This feels safe. It has some real problems.

## The opacity problem

Proprietary appliances run software you cannot inspect. When something goes wrong—and with network infrastructure, something always eventually goes wrong—you are dependent on the vendor's debugging tools, the vendor's support, and the vendor's timeline.

More practically: you cannot put a proprietary appliance's configuration in git and meaningfully review changes. You can export a configuration backup, but you cannot diff two configuration backups and understand what changed and why. The configuration exists in the GUI and in a binary backup format. It is not auditable text.

For clients who care about accountable IT—which is all of them, whether or not they articulate it that way—this is a problem. "The firewall changed" is not a useful answer to "why did this start failing?"

## The recovery problem

When a proprietary appliance fails, recovery requires:
- Having a current configuration backup (often not automated)
- Access to replacement hardware (the same model, often discontinued)
- The vendor's RMA process
- Potentially a support contract that may have lapsed

We have seen this scenario several times. A three-year-old Fortinet fails. The model is discontinued. The replacement model has a different CLI syntax. The configuration backup from the old unit requires manual translation. The client is down for days while this is sorted out.

Compare this to a NixOS router failure: boot a new commodity PC from a NixOS USB installer, run `nixos-install` with the configuration from git, reboot. Two hours, including the hardware drive to wherever the new machine is.

## The lock-in problem

Every proprietary appliance vendor charges for support, charges for advanced features as licensed add-ons, and has an upgrade path that leads to their next hardware generation. Switching vendors requires re-learning a new platform and often re-architecting the network.

None of this is malicious. It is the normal economics of proprietary platforms. But for small organisations that value operational independence, it is an ongoing cost and risk.

## What we use instead

We use commodity x86 hardware running NixOS for routers and firewalls. The specific software stack:
- **nftables** for firewall rules
- **Kea** for DHCP
- **Unbound** for DNS (with DNS-over-TLS upstream)
- **WireGuard** for VPN
- **BIRD** when we need routing protocol support

This is not exotic. It is the stack used by every Linux-based router distribution (pfSense, OPNsense, VyOS) under the hood, minus the proprietary GUI layer.

## The real tradeoff

Commodity NixOS routers require more initial setup than a GUI-configured appliance. The operator needs Linux and networking knowledge. If the team does not have that knowledge, a pfSense or OPNsense installation (open-source, commodity hardware) is a reasonable middle ground that preserves the recovery and auditability properties without requiring deep Nix expertise.

What we argue against: paying for a proprietary platform that cannot be audited, cannot be recovered cheaply, and creates ongoing vendor dependency. The cost of that dependency is paid in every incident.
