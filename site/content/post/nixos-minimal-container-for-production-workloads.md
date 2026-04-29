---
title: Building a Minimal NixOS Container for Production
date: 2026-02-03T09:00:00.000Z
description: >-
  Nix can build OCI container images declaratively. The resulting images contain
  exactly what you specify—no base image, no undeclared packages, no leftover
  package manager.
draft: true
---

Docker images built from Dockerfile tend to accumulate: a base image you do not fully control, packages installed during the build that are not needed at runtime, layers that cannot be easily audited. Nix builds OCI images differently.

## The problem with typical Dockerfiles

```dockerfile
FROM ubuntu:24.04
RUN apt-get update && apt-get install -y python3 python3-pip
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY app/ /app/
CMD ["python3", "/app/main.py"]
```

This image contains:
- All of Ubuntu's base packages (hundreds of binaries you do not use)
- apt, pip, build tools (not needed at runtime)
- Whatever was in the apt index at build time (not pinned)

The runtime attack surface is enormous. CVE scanners will flag dozens of packages in the base image that have nothing to do with your application.

## The Nix approach

```nix
# container.nix
{ pkgs, ... }:

pkgs.dockerTools.buildLayeredImage {
  name = "myapp";
  tag = "latest";

  contents = [
    pkgs.python311
    (pkgs.python311.pkgs.buildPythonPackage {
      pname = "myapp";
      version = "1.0.0";
      src = ./app;
      propagatedBuildInputs = with pkgs.python311.pkgs; [
        requests
        fastapi
        uvicorn
      ];
    })
    # Minimal utilities for the container
    pkgs.cacert         # SSL certificate bundle
    pkgs.tzdata         # Timezone data
  ];

  config = {
    Cmd = [ "python3" "-m" "uvicorn" "app.main:app" "--host" "0.0.0.0" "--port" "8000" ];
    ExposedPorts = { "8000/tcp" = {}; };
    User = "nobody";
  };
}
```

Build with:
```sh
nix build .#container
docker load < result
```

## What the image contains

The resulting image contains exactly:
- Python 3.11 and your application's Python dependencies
- SSL certificates (needed for HTTPS requests)
- Timezone data
- Nothing else

No shell, no package manager, no build tools. No apt, no pip, no curl. The attack surface is the application and its direct dependencies.

Running `docker run --rm myapp sh` fails—there is no shell to invoke.

## Layer caching

`buildLayeredImage` creates separate layers for each dependency in the closure. Dependencies that are shared between builds (like Python itself) are cached and reused. Only the application layer changes between builds.

## Integration with the fleet

Container images built this way can be referenced in NixOS configurations directly:

```nix
virtualisation.oci-containers.containers.myapp = {
  image = "myapp:latest";
  imageFile = pkgs.callPackage ./container.nix {};
  ports = [ "8000:8000" ];
};
```

The container image is a build output of the same flake as the NixOS configuration. Everything is pinned together. When you update nixpkgs, the container image is rebuilt with the updated packages.
