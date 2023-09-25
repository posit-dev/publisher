#!/usr/bin/env bash

docker pull -q ghcr.io/choffmeister/git-describe-semver:latest > /dev/null
docker run --rm -v $PWD:/workdir ghcr.io/choffmeister/git-describe-semver:latest \
    -drop-prefix \
    --fallback v0.0.0
