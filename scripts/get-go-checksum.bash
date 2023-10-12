#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
    echo "usage: $0 <platform>"
    exit 1
fi

platform=$1

case ${platform} in
    "linux/amd64")
        echo "1241381b2843fae5a9707eec1f8fb2ef94d827990582c7c7c32f5bdfbfd420c8"
    ;;
    "linux/arm64")
        echo "fc90fa48ae97ba6368eecb914343590bbb61b388089510d0c56c2dde52987ef3"
    ;;
    *)
        echo "error: Platform not recognized. Found \`${platform}\`." 1>&2
        exit 1
    ;;
esac
