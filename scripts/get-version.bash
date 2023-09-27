#!/usr/bin/env bash
set -euo pipefail

version=$(git describe --tags)
echo "${version/v/}"
