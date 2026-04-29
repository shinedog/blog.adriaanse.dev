---
title: "Home Manager: Declarative Developer Workstations"
date: 2026-02-24T09:00:00.000Z
description: >-
  Home Manager brings the same declarative model that NixOS applies to servers
  to your personal workstation configuration—dotfiles, packages, shell,
  editor config, all version-controlled.
draft: true
---

We use NixOS on servers. The same principles—reproducibility, declarative configuration, version-controlled state—apply to developer workstations. Home Manager is the tool for this.

## What Home Manager does

Home Manager manages your user-level environment: installed packages, dotfiles, shell configuration, editor plugins, fonts, systemd user services. It generates configuration files from a declarative specification rather than requiring you to manage dotfiles manually.

It works on both NixOS (as a NixOS module) and on other Linux distributions or macOS (standalone).

## A practical configuration

```nix
# home.nix
{ config, pkgs, ... }: {

  home.packages = with pkgs; [
    # Development tools
    git
    gh
    jq
    ripgrep
    fd
    bat
    delta
    direnv
    nix-direnv

    # Infrastructure
    deploy-rs
    agenix
    terraform
    kubectl
    helm

    # Communication
    signal-desktop
  ];

  programs.git = {
    enable = true;
    userName = "Your Name";
    userEmail = "you@example.com";
    signing = {
      key = "your-gpg-key-id";
      signByDefault = true;
    };
    extraConfig = {
      pull.rebase = true;
      push.autoSetupRemote = true;
      diff.algorithm = "histogram";
      merge.conflictstyle = "diff3";
    };
    delta = {
      enable = true;
      options = {
        navigate = true;
        light = false;
        side-by-side = true;
      };
    };
  };

  programs.zsh = {
    enable = true;
    enableCompletion = true;
    autosuggestions.enable = true;
    syntaxHighlighting.enable = true;
    initExtra = ''
      eval "$(direnv hook zsh)"
    '';
  };

  programs.neovim = {
    enable = true;
    defaultEditor = true;
    plugins = with pkgs.vimPlugins; [
      nvim-lspconfig
      nvim-treesitter
      telescope-nvim
      null-ls-nvim
    ];
  };

  programs.direnv = {
    enable = true;
    nix-direnv.enable = true;
  };
}
```

## Why this is worth the setup cost

**Reproducibility.** A new machine is set up by running `home-manager switch`. Every package, every dotfile, every editor plugin is installed exactly as specified. No "what did I have installed on the old machine?"

**Version control.** The configuration lives in git. Every change to your environment is a commit. You can see when you added a tool, why you changed a configuration option, and roll back if something breaks.

**Consistency across machines.** We have the same environment on the work laptop, the personal laptop, and the CI worker. Any tool that works locally works in CI, pinned to the same version.

## The dotfile generation model

Home Manager generates dotfiles from the declarative configuration. If you use `programs.git`, Home Manager writes `~/.gitconfig`. If you want custom options not covered by the module, you can use `xdg.configFile` to manage arbitrary files.

The principle: prefer using the Home Manager module for a program over manually managing its dotfiles. The module usually handles edge cases (like XDG directory locations) better than a manually managed dotfile.

## Team adoption

We provide a starter Home Manager configuration in our fleet repository's `devshell`. New operators can adopt the tool gradually—they do not need to manage their entire environment declaratively to benefit from consistent tool versions.
