---
title: WireGuard VPN Gateway on NixOS
date: 2026-01-20T09:00:00.000Z
description: >-
  WireGuard is fast, auditable, and has excellent NixOS module support. Here is
  how we configure a management VPN gateway that every host in the fleet peers
  with.
draft: true
---

Every server we manage is accessible through a WireGuard VPN gateway. Public SSH is disabled. Management access requires being on the VPN. This is a straightforward control that eliminates entire classes of attack.

## The architecture

We run a dedicated VPN gateway host—usually the cheapest VPS we can find with a static IP. Every other host in the fleet peers with the gateway. Management access (SSH, Prometheus, Grafana) is only permitted from VPN addresses.

The gateway itself has a minimal attack surface: no services other than WireGuard and SSH (port-knocked or limited to the operator's IP).

## Gateway configuration

```nix
networking.wireguard.interfaces.wg0 = {
  ips = [ "10.100.0.1/24" ];
  listenPort = 51820;
  privateKeyFile = config.age.secrets.wireguardPrivateKey.path;

  peers = [
    {
      # monitoring host
      publicKey = "...";
      allowedIPs = [ "10.100.0.2/32" ];
    }
    {
      # backup host
      publicKey = "...";
      allowedIPs = [ "10.100.0.3/32" ];
    }
    {
      # operator laptop
      publicKey = "...";
      allowedIPs = [ "10.100.0.100/32" ];
    }
  ];
};

networking.firewall = {
  allowedUDPPorts = [ 51820 ];
  extraCommands = ''
    iptables -A FORWARD -i wg0 -j ACCEPT
    iptables -A FORWARD -o wg0 -j ACCEPT
    iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
  '';
};
```

## Peer configuration (on managed hosts)

```nix
networking.wireguard.interfaces.wg0 = {
  ips = [ "10.100.0.2/24" ];
  privateKeyFile = config.age.secrets.wireguardPrivateKey.path;

  peers = [{
    publicKey = "gateway-public-key";
    allowedIPs = [ "10.100.0.0/24" ];
    endpoint = "gateway.example.com:51820";
    persistentKeepalive = 25;
  }];
};

# Only permit SSH from VPN subnet
services.openssh.listenAddresses = [{
  addr = "10.100.0.2";
  port = 22;
}];
```

The host only accepts SSH connections on the WireGuard interface. There is no SSH listener on the public interface.

## Key management

WireGuard private keys are managed with agenix. Public keys are committed in plaintext to the flake (they are public). Each host generates its key pair during provisioning:

```sh
wg genkey | tee private.key | wg pubkey > public.key
# Encrypt private.key with agenix, commit public.key to secrets.nix
```

## Monitoring the VPN

We monitor peer connectivity from the gateway with a small script that checks `wg show` output and alerts if any expected peer has not had a handshake in more than 3 minutes. A peer that has not had a recent handshake cannot reach the management network, which usually means the host is down or unreachable.

This gives us host reachability monitoring as a side effect of the VPN setup, without any additional agent.
