---
title: NixOS as a Router and Firewall with nftables
date: 2026-01-28T09:00:00.000Z
description: >-
  NixOS makes an excellent firewall and router. Declarative nftables rules,
  version-controlled, with no risk of manual rule accumulation. Here is a
  practical configuration.
draft: true
---

The standard advice for small-business firewalls is to buy a dedicated appliance—a Fortinet, a Ubiquiti, a pfSense box. We have moved away from appliances for clients who want open, recoverable infrastructure. A NixOS router on commodity hardware gives you more visibility, better auditability, and no vendor lock-in.

## Why NixOS makes a good firewall

- **Declarative rules.** The entire firewall ruleset is in the configuration file. No GUI, no hidden state, no rules added by a support technician that nobody knows about.
- **Version controlled.** Changes to firewall rules go through the same git workflow as everything else. Every change has an author, a timestamp, and a reason.
- **No drift.** Rules that are removed from the configuration are removed from the running system. There is no firewall rule archaeology.

## Basic nftables configuration in NixOS

```nix
networking.nftables.enable = true;
networking.nftables.ruleset = ''
  table inet filter {
    chain input {
      type filter hook input priority 0; policy drop;

      # Allow established connections
      ct state { established, related } accept

      # Allow loopback
      iif lo accept

      # Allow ICMP
      ip protocol icmp accept
      ip6 nexthdr icmpv6 accept

      # WireGuard
      udp dport 51820 accept

      # SSH from management VPN only
      iifname "wg0" tcp dport 22 accept

      # Drop everything else
      log prefix "dropped: " drop
    }

    chain forward {
      type filter hook forward priority 0; policy drop;

      # Allow forwarding between trusted interfaces
      iifname "wg0" oifname "eth1" accept
      iifname "eth1" oifname "wg0" ct state { established, related } accept
    }

    chain output {
      type filter hook output priority 0; policy accept;
    }
  }

  table ip nat {
    chain postrouting {
      type nat hook postrouting priority 100;
      oifname "eth0" masquerade
    }
  }
'';
```

## Interface naming

Modern Linux uses predictable interface names (`eth0`, `enp3s0`, etc.). NixOS does not rename interfaces by default, which can cause configuration to depend on hardware layout. We use `networking.usePredictableInterfaceNames = false` on router hosts and document the physical port layout in the host configuration comments.

## DHCP and DNS

For networks where we also provide DHCP and local DNS:

```nix
services.kea.dhcp4 = {
  enable = true;
  settings = {
    interfaces-config.interfaces = [ "eth1" ];
    subnet4 = [{
      subnet = "192.168.1.0/24";
      pools = [{ pool = "192.168.1.100 - 192.168.1.200"; }];
      option-data = [
        { name = "routers"; data = "192.168.1.1"; }
        { name = "domain-name-servers"; data = "192.168.1.1"; }
      ];
    }];
  };
};

services.unbound = {
  enable = true;
  settings = {
    server = {
      interface = [ "127.0.0.1" "192.168.1.1" ];
      access-control = [ "192.168.1.0/24 allow" ];
      forward-zone = [{
        name = ".";
        forward-tls-upstream = true;
        forward-addr = [
          "1.1.1.1@853"
          "1.0.0.1@853"
        ];
      }];
    };
  };
};
```

DNS-over-TLS upstream means client queries are not visible to the ISP. For small businesses handling sensitive client data, this is worth the marginal complexity.

## The recovery story

If this router fails, replacement is: boot a new machine from a NixOS USB installer, run `nixos-install` with the configuration from git, reboot. The new router is identical to the old one. No appliance RMA, no backup config restore, no vendor support call.
