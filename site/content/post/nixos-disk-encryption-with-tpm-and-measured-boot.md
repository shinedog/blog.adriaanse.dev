---
title: "NixOS Disk Encryption with TPM and Measured Boot"
date: 2026-04-18T09:00:00.000Z
description: >-
  Full disk encryption at rest protects data when hardware is stolen. TPM-based
  automatic unlocking means you get encryption without requiring physical
  presence to enter a passphrase at every reboot.
draft: true
---

Full disk encryption is a standard requirement for any system that might leave your physical control: laptops, systems in shared co-location facilities, servers shipped to remote offices. The barrier to adoption is usually operational: requiring someone to type a passphrase at every reboot is not compatible with automated restarts after patching.

TPM-based disk encryption solves this. The passphrase is stored in the TPM and automatically released on boot—unless the system has been tampered with, in which case the TPM refuses to release it.

## How TPM unlocking works

The TPM (Trusted Platform Module) is a security chip on the motherboard. It can store secrets and conditionally release them based on measurements of the boot process.

When you set up TPM-based disk encryption:
1. During setup, the disk is encrypted with a key that is sealed into the TPM
2. The TPM records measurements of the boot components (firmware, bootloader, kernel)
3. On subsequent boots, the TPM checks the measurements against the expected values
4. If they match (no tampering), the TPM releases the key and the disk unlocks automatically
5. If they do not match (bootloader modified, different kernel, physical attack), the TPM does not release the key

## NixOS configuration

NixOS 23.11+ has good support for TPM2-backed LUKS via `systemd-cryptenroll`:

```nix
# hardware-configuration.nix or configuration.nix
boot.initrd = {
  luks.devices."cryptroot" = {
    device = "/dev/disk/by-uuid/...";
    allowDiscards = true;
    crypttabExtraOpts = [ "tpm2-device=auto" ];
  };

  systemd.enable = true; # Required for TPM2 support in initrd
};

# Measure the boot process
security.tpm2 = {
  enable = true;
  pkcs11.enable = true;
  tctiEnvironment.enable = true;
};
```

To enroll the TPM after initial setup:
```sh
systemd-cryptenroll --tpm2-device=auto --tpm2-pcrs=0+2+7 /dev/disk/by-uuid/...
```

PCR values specify which measurements are included in the binding:
- PCR 0: firmware measurements
- PCR 2: extended firmware measurements  
- PCR 7: Secure Boot state

With PCR 7, the disk will only unlock if Secure Boot is enabled and the same keys are present. This prevents booting from a modified bootloader.

## For servers vs. laptops

For servers, TPM-based automatic unlocking is the right choice. Servers restart without human intervention; requiring a passphrase would leave an encrypted server stuck at the unlock prompt after a reboot.

For laptops, we use full disk encryption with a strong passphrase and Secure Boot. The threat model for a laptop is physical theft, where the attacker has physical access but not the passphrase. A TPM that automatically unlocks on boot is weaker against a physical attacker who can extract the disk.

The laptop vs. server distinction matters: design the unlocking mechanism for the actual threat model, not the worst case.

## Network-based unlocking (Tang/Clevis)

For servers in environments without a TPM, or where you want the unlocking tied to network access rather than hardware:

```nix
boot.initrd.network.ssh = {
  enable = true;
  port = 2222;
  authorizedKeys = [ "ssh-ed25519 AAAA... management key" ];
  hostKeys = [ "/etc/secrets/initrd_host_key" ];
};
```

With initrd SSH, you connect to the server before the root filesystem mounts and supply the passphrase remotely. Not automatic, but requires no physical presence.

Tang/Clevis goes further: the passphrase is automatically provided by a Tang server on the network. If the server can reach the Tang server, it unlocks. If it cannot (stolen hardware, moved to a different network), it does not.
