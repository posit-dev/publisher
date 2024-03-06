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
    if [[ "${DOCKER_CONNECT}" = true ]]; then
        docker-compose -f ../docker-compose.yml up -d
        export CONNECT_SERVER="http://localhost:3939"
        export CONNECT_API_KEY="$(python ../setup/gen_apikey.py 'admin')"
        # wait until Connect is available
        timeout 100 bash -c \
        'while [[ "$(curl -s -o /dev/null -w ''%{http_code}'' ${CONNECT_SERVER}/__ping__)" != "200" ]]; \
            do sleep 1; \
            echo "retry"; \
        done'
    else
        export CONNECT_SERVER="$(python ../setup/connect_setup.py)"
        export CONNECT_API_KEY="$(python ../setup/gen_apikey.py 'admin')"
    fi
}

# use this if you need content
content_tests() {
    if [[ ${_ci} == false ]]; then
        mkdir -p ../content/bundles/
        cp -R "${HOME}${CONTENT_REPO}/bundles/" ../content/bundles
    fi
    # pull the content from connect-content repo
    if [[ "${CONTENT}" == "all" ]]; then
        CONTENT=$(find "../content/bundles" -maxdepth 1 -type d -exec basename {} \;)
    fi
    for i in ${CONTENT}
    do
        # only test when we have a .publisher-env file for the content
        if [[ -f ../content/bundles/${i}/test/.publisher-env ]]; then
            export CONTENT=${i}
            export EXE=$exe 
            just run "${test_case}"
        fi
    done
}

# use this for generic tests
cli_tests() {   
    export EXE=$exe 
    just run "${test_case}"
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
