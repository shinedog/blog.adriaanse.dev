---
title: "agenix: Managing Secrets in a NixOS Fleet"
date: 2026-04-15T09:00:00.000Z
description: >-
  Secrets management is the awkward gap in declarative infrastructure. agenix
  fills it cleanly by encrypting secrets to host SSH keys—no external service
  required.
---

One of the first questions people ask about managing infrastructure in git is: what do you do with secrets? Passwords, API keys, certificates—you cannot commit them in plaintext.

We use [agenix](https://github.com/ryantm/agenix), which takes a simple approach: secrets are encrypted using `age` to the SSH host keys of the machines that need them. The encrypted files live in git. Only the machines with the corresponding private keys can decrypt them.

## How it works

Each secret is an age-encrypted file. The `secrets.nix` file in your repository maps each secret to the list of public keys that can decrypt it:

```nix
let
  monitoring = "ssh-ed25519 AAAA... monitoring host key";
  backup = "ssh-ed25519 AAAA... backup host key";
  admin = "ssh-ed25519 AAAA... admin laptop key";
in {
  "grafana-admin-password.age".publicKeys = [ monitoring admin ];
  "borgbackup-passphrase.age".publicKeys = [ backup admin ];
  "wireguard-private-key.age".publicKeys = [ monitoring admin ];
}
```

To create or rotate a secret:

```sh
agenix -e secrets/grafana-admin-password.age
```

This opens your `$EDITOR`. You type the secret. On save, it is encrypted to all listed public keys and written to the file. You commit the `.age` file. No plaintext ever touches disk (other than in your editor's temp files, which is a reasonable tradeoff).

## Using secrets in NixOS configuration

The agenix NixOS module decrypts secrets at activation time and places them in `/run/agenix/`:

```nix
age.secrets.grafanaAdminPassword = {
  file = ../secrets/grafana-admin-password.age;
  owner = "grafana";
};

services.grafana.settings.security = {
  admin_password = "$__file{${config.age.secrets.grafanaAdminPassword.path}}";
};
```

The secret file is a tmpfs path that exists only in memory. It is not written to disk. It is readable only by the specified owner.

## Admin key management

The admin key in `secrets.nix` is our management laptop's SSH key. This means we can decrypt any secret when we need to, and we can re-encrypt secrets when rotating keys—without needing to access the hosts themselves.

When a host is decommissioned, we remove its key from `secrets.nix` and re-encrypt. The old host can no longer decrypt anything even if the private key is compromised. This is not true of most alternatives.

## What agenix does not do

agenix is intentionally minimal. It does not do secret rotation, auditing of access, or dynamic secrets. If you need those, tools like HashiCorp Vault or AWS Secrets Manager are appropriate. For the small organisations we work with—where the threat model is credential theft rather than insider access to a secret management system—agenix's simplicity is a feature.

The entire secrets management system is: encrypted files in git, SSH host keys on servers, one CLI tool. There is no service to maintain, no network dependency for activation, and no additional attack surface. Everything is auditable from the git log.

## Gotchas

One: if you re-provision a host, it gets a new SSH host key. You must re-encrypt all of that host's secrets to the new key before the new host can activate. We handle this with a provisioning runbook that includes a secrets re-encryption step.

Two: the admin key must always be listed for secrets the team manages. We enforce this with a simple script that validates `secrets.nix` has the admin key on every secret before allowing a commit.
