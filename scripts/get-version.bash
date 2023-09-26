#!/usr/bin/env bash
set -euo pipefail

git describe --tags | sed 's/\v\(.*\).*/\1/'
