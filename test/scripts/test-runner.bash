#!/usr/bin/env bash
set -euo pipefail

test_case=$1

exe=$(just ../../executable-path)

if [ ! -f $exe ]; then
    echo "error: Missing executable $exe. Run \`just build\`." 1>&2
    exit 1
fi

# use this if you need Connect
setup_connect() {
    pip install -r ../setup/requirements.txt
    export CONNECT_SERVER="$(python ../setup/connect_setup.py)"
    export CONNECT_API_KEY="$(python ../setup/gen_apikey.py 'admin')"
}

# use this if you need content
content_tests() {
    # pull the content from connect-content repo
    if [[ "${CONTENT}" == "all" ]]; then
        if [[ ${_ci} == false ]]; then
            mkdir -p ../content/bundles/
            cp -R ${HOME}${CONTENT_REPO}/bundles/ ../content/bundles/
        fi

        # content_list will contain all content in
        content_list=$(find "../content/bundles" -maxdepth 1 -type d -exec basename {} \;)
        for i in ${content_list}
        do
            # only test when we have a .publisher-env file for the content
            if [[ -f ../content/bundles/${i}/test/.publisher-env ]]; then
                export CONTENT=${i}
                EXE=$exe npm run "${test_case}"
            fi
        done
    else
        cp -R "${HOME}${CONTENT_REPO}/bundles/${CONTENT}" ../content/
        EXE=$exe npm run "${test_case}"
    fi
}

# use this for generic tests
cli_tests() {   
    # run contract/accounts.bats
    EXE=$exe npm run "${test_case}"
}

case "${test_case}" in
    "deploy")
        setup_connect
        content_tests
    ;;
    "init")
        content_tests
    ;;
    "accounts")
        setup_connect
        cli_tests
    ;;
    "common")
        cli_tests
    ;;
esac
