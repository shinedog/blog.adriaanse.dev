---
title: "Monitoring Stack on NixOS: Prometheus, Grafana, Alertmanager"
date: 2026-02-17T09:00:00.000Z
description: >-
  The Prometheus ecosystem has excellent NixOS module support. Here is how we
  configure a monitoring host that covers every server in the fleet, with
  alerting that actually pages on the things that matter.
draft: true
---

Monitoring that does not alert on the right things is noise. Monitoring that does not alert on failing things is false confidence. Getting the balance right matters more than the specific tools you use.

We use Prometheus for metrics collection, Grafana for dashboards, and Alertmanager for routing alerts. All configured declaratively in NixOS.

## Prometheus configuration

```nix
services.prometheus = {
  enable = true;
  port = 9090;

  globalConfig = {
    scrape_interval = "60s";
    evaluation_interval = "60s";
  };

  scrapeConfigs = [
    {
      job_name = "node";
      static_configs = [{
        targets = [
          "monitoring.wg:9100"
          "backup.wg:9100"
          "gateway.wg:9100"
        ];
      }];
    }
    {
      job_name = "borgbackup";
      static_configs = [{
        targets = [ "monitoring.wg:9099" ];
      }];
    }
  ];

  ruleFiles = [ ./alerting-rules.yml ];

  alertmanager = {
    enable = true;
    configuration = {
      route = {
        receiver = "ops";
        group_by = [ "alertname" "host" ];
        group_wait = "30s";
        group_interval = "5m";
        repeat_interval = "4h";
      };
      receivers = [{
        name = "ops";
        pagerduty_configs = [{
          service_key = "$__file{${config.age.secrets.pagerdutyKey.path}}";
        }];
      }];
    };
  };
};
```

## node_exporter on every host

Every managed host exports system metrics:

```nix
services.prometheus.exporters.node = {
  enable = true;
  port = 9100;
  enabledCollectors = [
    "systemd"
    "processes"
    "interrupts"
    "tcpstat"
    "diskstats"
    "filesystem"
    "meminfo"
    "netdev"
    "loadavg"
    "cpu"
    "uname"
  ];
  openFirewall = false; # Only accessible via VPN
  listenAddress = "10.100.0.x"; # VPN address only
};
```

The exporter listens on the WireGuard interface only. Prometheus scrapes over the VPN. Metrics are never exposed publicly.

## Alerting rules that matter

```yaml
# alerting-rules.yml
groups:
  - name: host
    rules:
      - alert: HostDown
        expr: up == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Host {{ $labels.instance }} is unreachable"

      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.15
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Disk on {{ $labels.instance }} is {{ $value | humanizePercentage }} full"

      - alert: BackupMissed
        expr: time() - backup_last_success_timestamp > 86400 * 1.5
        labels:
          severity: critical
        annotations:
          summary: "Backup on {{ $labels.host }} has not succeeded in 36 hours"

      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) > 0.9
        for: 15m
        labels:
          severity: warning

      - alert: SystemdUnitFailed
        expr: node_systemd_unit_state{state="failed"} == 1
        labels:
          severity: warning
        annotations:
          summary: "Systemd unit {{ $labels.name }} failed on {{ $labels.instance }}"
```

The backup alert is a dead man's switch: it fires if a backup has not succeeded in 36 hours. We do not alert on backup failure—we alert on the absence of recent backup success. The distinction catches cases where the backup job is not running at all, not just cases where it ran and failed.

## What we deliberately do not monitor

We do not set up alerts for every possible metric. CPU usage alone does not page anyone. Memory usage alone does not page anyone. These are useful for investigation but rarely indicate an actionable problem by themselves.

We alert on: host unreachable, disk critically low, backup missed, systemd unit failed, certificate expiry within 14 days. That is it. Everything else is available in dashboards for when you need it.
