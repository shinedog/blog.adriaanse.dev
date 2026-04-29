---
title: "CrowdSec on NixOS: Community Threat Intelligence"
date: 2026-03-22T09:00:00.000Z
description: >-
  CrowdSec is a modern intrusion detection system that shares threat
  intelligence across its user community. Here is how we configure it on NixOS
  and what it actually catches.
draft: true
---

fail2ban is the traditional answer to "how do I ban IPs that are hammering my SSH port." It works. It is also reactive—it bans an IP after it has already generated noise. CrowdSec takes a different approach: it shares threat intelligence across a community of users, so you can block IPs that are attacking other people's systems before they reach yours.

## What CrowdSec does

CrowdSec is two things:
1. A local agent that parses logs and detects attack patterns (similar to fail2ban)
2. A community threat intelligence feed: IPs that are flagged by the community get added to a shared blocklist

When an IP attacks enough CrowdSec instances, it ends up on the community blocklist. Your instance receives that blocklist and blocks the IP proactively, even if it has never attacked you directly.

## NixOS configuration

```nix
services.crowdsec = {
  enable = true;
  acquisitions = [
    {
      filenames = [ "/var/log/auth.log" ];
      labels.type = "syslog";
    }
    {
      filenames = [ "/var/log/nginx/access.log" ];
      labels.type = "nginx";
    }
  ];
  settings = {
    api.server = {
      listen_uri = "127.0.0.1:8080";
    };
  };
};

# Bouncer: translates CrowdSec decisions into actual blocks
services.crowdsec-firewall-bouncer = {
  enable = true;
  settings = {
    mode = "nftables";
    api_url = "http://127.0.0.1:8080";
    api_key = ""; # set via agenix
    nftables = {
      ipv4 = {
        enabled = true;
        set-only = false;
        table = "crowdsec";
        chain = "crowdsec-chain";
      };
    };
  };
};
```

The `firewall-bouncer` is the component that actually translates CrowdSec decisions into firewall rules. Without a bouncer, CrowdSec detects attacks but does not block anything.

## What it catches

From our deployment across several client sites, the community blocklist catches:
- SSH brute force from known botnet IPs before the first connection attempt
- Web scanner IPs (Shodan, Censys, exploit scanners)
- IPs involved in credential stuffing

The local detection layer catches:
- SSH brute force from IPs not yet in the community blocklist
- Nginx 4xx rate anomalies indicating scanning
- Failed authentication sequences

## Vs. fail2ban

We replaced fail2ban with CrowdSec on all new deployments. The community blocklist is the main reason—it is proactive rather than reactive. The NixOS module support for CrowdSec is also more complete than for fail2ban in recent nixpkgs versions.

For existing fail2ban deployments, the migration is straightforward: install CrowdSec, install a bouncer, remove fail2ban. The log sources and detection logic are equivalent; you gain the community blocklist.

## Monitoring CrowdSec

CrowdSec exposes Prometheus metrics. We scrape them on the monitoring host:

```nix
services.prometheus.scrapeConfigs = [{
  job_name = "crowdsec";
  static_configs = [{
    targets = [ "host.wg:6060" ];
  }];
}];
```

Key metrics: decisions made per hour, alerts triggered by scenario, community blocklist size. An anomalous spike in decisions usually means someone is actively probing. Worth an alert.
