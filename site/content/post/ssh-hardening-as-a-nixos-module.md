---
title: SSH Hardening as a NixOS Module
date: 2026-02-28T09:00:00.000Z
description: >-
  SSH is the management interface for every server we run. Its configuration
  is the first thing we harden, and as a NixOS module it is applied
  consistently and verifiably to every host.
draft: true
---

SSH configuration is one of those things that every security guide tells you to harden and very few teams actually maintain consistently. Default OpenSSH settings are permissive for compatibility reasons. Tightening them is a documented, known process. The problem is applying it uniformly and keeping it applied.

As a NixOS module, SSH hardening is applied to every host that imports the module, every time the system is rebuilt. It cannot drift.

## The module

```nix
# modules/ssh-hardening.nix
{ config, lib, pkgs, ... }: {

  services.openssh = {
    enable = true;
    ports = [ 22 ];

    settings = {
      # Authentication
      PasswordAuthentication = false;
      PermitRootLogin = "no";
      PubkeyAuthentication = true;
      AuthorizedKeysFile = ".ssh/authorized_keys";
      KbdInteractiveAuthentication = false;
      UsePAM = true;

      # Session limits
      MaxAuthTries = 3;
      MaxSessions = 10;
      LoginGraceTime = 30;
      ClientAliveInterval = 300;
      ClientAliveCountMax = 2;

      # Forwarding (disabled)
      AllowAgentForwarding = false;
      AllowTcpForwarding = false;
      X11Forwarding = false;
      PermitTunnel = false;

      # Logging
      LogLevel = "VERBOSE";
      SyslogFacility = "AUTH";

      # Protocol hardening
      Ciphers = [
        "chacha20-poly1305@openssh.com"
        "aes256-gcm@openssh.com"
        "aes128-gcm@openssh.com"
        "aes256-ctr"
        "aes192-ctr"
        "aes128-ctr"
      ];
      KexAlgorithms = [
        "curve25519-sha256"
        "curve25519-sha256@libssh.org"
        "diffie-hellman-group16-sha512"
        "diffie-hellman-group18-sha512"
      ];
      Macs = [
        "hmac-sha2-512-etm@openssh.com"
        "hmac-sha2-256-etm@openssh.com"
        "umac-128-etm@openssh.com"
      ];
    };

    extraConfig = ''
      AllowGroups wheel
      StrictModes yes
    '';
  };

  # Host keys: only Ed25519
  services.openssh.hostKeys = [{
    path = "/etc/ssh/ssh_host_ed25519_key";
    type = "ed25519";
  }];
}
```

## Why these specific settings

**PasswordAuthentication = false.** Every brute-force attack against SSH tries passwords. With password authentication disabled, those attacks generate log noise and nothing else. Public key authentication is unaffected by password brute-force.

**PermitRootLogin = "no".** Root access requires first authenticating as a non-root user and then using sudo. This adds a layer and produces an audit trail (sudo logs).

**AllowGroups = wheel.** Only users in the `wheel` group can log in via SSH. A compromised service account that is not in `wheel` cannot use SSH.

**Cipher and algorithm restrictions.** The listed ciphers, KEx algorithms, and MACs are current (as of 2024) recommendations from Mozilla's SSH hardening guide. They exclude weak or deprecated algorithms.

**ClientAliveInterval = 300 / ClientAliveCountMax = 2.** Idle sessions are terminated after 10 minutes of no keepalives. This limits the window for session hijacking on unattended terminals.

## Testing the configuration

```nix
# tests/ssh-hardening.nix
pkgs.nixosTest {
  name = "ssh-hardening";
  nodes.server = { ... }: { imports = [ ../modules/ssh-hardening.nix ]; };
  testScript = ''
    server.start()
    server.wait_for_unit("sshd")
    out = server.succeed("sshd -T | tr '[:upper:]' '[:lower:]'")
    assert "passwordauthentication no" in out
    assert "permitrootlogin no" in out
    assert "allowtcpforwarding no" in out
    assert "x11forwarding no" in out
  '';
}
```

The test runs in CI. If someone changes a setting that weakens the SSH configuration, the test fails before the change reaches production.
