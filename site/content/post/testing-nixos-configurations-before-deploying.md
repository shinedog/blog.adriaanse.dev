---
title: Testing NixOS Configurations Before Deploying
date: 2026-02-04T09:00:00.000Z
description: >-
  NixOS has a first-class VM testing framework built into nixpkgs. You can boot
  your actual configuration in a VM and run assertions before touching a
  production host.
draft: true
---

One of the least-understood capabilities of NixOS is the built-in testing framework. It lets you define integration tests as Nix expressions: boot one or more VMs from your actual NixOS configurations, run Python test scripts against them, and get pass/fail results. No mocking required.

## What the framework is

`nixos/tests` in nixpkgs is a collection of tests using `nixpkgs.lib.nixosTest`. Each test defines:
- One or more NixOS VM configurations (your actual modules, or simplified versions)
- A Python script that controls the VMs and asserts behaviour

Tests run via QEMU. They are hermetic and reproducible.

## A simple test

```nix
# tests/ssh-hardening.nix
{ pkgs, ... }:

pkgs.nixosTest {
  name = "ssh-hardening";

  nodes.server = { config, pkgs, ... }: {
    imports = [ ../modules/hardening.nix ];
    services.openssh.enable = true;
  };

  testScript = ''
    server.start()
    server.wait_for_unit("sshd")

    # Verify PasswordAuthentication is disabled
    output = server.succeed("sshd -T | grep passwordauthentication")
    assert "passwordauthentication no" in output, f"Expected no password auth, got: {output}"

    # Verify root login is disabled
    output = server.succeed("sshd -T | grep permitrootlogin")
    assert "permitrootlogin no" in output, f"Expected no root login, got: {output}"

    # Verify AllowTcpForwarding is disabled
    output = server.succeed("sshd -T | grep allowtcpforwarding")
    assert "allowtcpforwarding no" in output
  '';
}
```

Run it with:
```sh
nix build .#checks.x86_64-linux.ssh-hardening
```

If any assertion fails, the build fails. This integrates directly with CI.

## Testing backup configuration

```nix
pkgs.nixosTest {
  name = "borgbackup";

  nodes = {
    server = { ... }: {
      imports = [ ../modules/backup.nix ];
      # Override the remote to point to the local backup node
      services.borgbackup.jobs.main.repo = "backup:/backups/server";
    };

    backup = { ... }: {
      services.openssh.enable = true;
      users.users.borg = {
        isSystemUser = true;
        group = "borg";
        home = "/backups";
        shell = pkgs.bash;
        openssh.authorizedKeys.keys = [ "..." ];
      };
    };
  };

  testScript = ''
    backup.start()
    server.start()
    backup.wait_for_unit("sshd")
    server.wait_for_unit("borgbackup-job-main.service")

    # Trigger the backup job
    server.systemctl("start borgbackup-job-main.service")
    server.wait_for_unit("borgbackup-job-main.service")

    # Verify the archive was created
    server.succeed("borg list backup:/backups/server | grep -q .")
  '';
}
```

## Running tests in CI

In the flake, tests are exposed as `checks`:

```nix
checks.x86_64-linux = {
  ssh-hardening = import ./tests/ssh-hardening.nix { inherit pkgs; };
  borgbackup = import ./tests/borgbackup.nix { inherit pkgs; };
};
```

Forgejo Actions or GitHub Actions can run `nix flake check` which builds all checks in parallel. A configuration change that breaks SSH hardening will fail the check before it reaches a production host.

## Limitations

Tests run in QEMU VMs, so hardware-specific things (specific NIC drivers, real disk performance) are not tested. Tests are also relatively slow—a simple test typically takes 30-120 seconds depending on the service under test. We run them in CI, not as a pre-commit hook.
