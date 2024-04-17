#!/usr/bin/env bats

load '../node_modules/bats-support/load'
load '../node_modules/bats-assert/load'
source ../content/bundles/${CONTENT}/test/.publisher-env
CONTENT_PATH='../content/bundles'
FULL_PATH="${CONTENT_PATH}/${CONTENT}"

# helper funciton for deploys
deploy_assertion() {
    if [[ ${quarto_r_content[@]} =~ ${CONTENT} ]]; then
        assert_output --partial "error detecting content type: quarto with knitr engine is not yet supported."
    else
        assert_success
        assert_output --partial "Test Deployment...                 [OK]"

        # test the deployment via api
        GUID="$(echo "${output}" | \
            grep "Direct URL:" | \
            grep -o -E '[0-9a-f-]{36}')"

        run curl --silent --show-error -L --max-redirs 0 --fail \
            -X GET \
            -H "Authorization: Key ${CONNECT_API_KEY}" \
            "${CONNECT_SERVER}/__api__/v1/content/${GUID}"
        assert_output --partial "\"app_mode\":\"${APP_MODE}\""
        assert_output --partial "\"description\":\"${CONTENT} description\""
        assert_output --partial "\"read_timeout\":30"
        assert_output --partial "\"init_timeout\":35"
        assert_output --partial "\"idle_timeout\":40"
        assert_output --partial "\"max_processes\":2"
        assert_output --partial "\"min_processes\":1"
        assert_output --partial "\"max_conns_per_process\":5"
        assert_output --partial "\"load_factor\":0.8"
    fi
}

init_with_fields() {
    run ${EXE} init -c ${CONTENT} ${FULL_PATH}
    # init to create default.toml
    if [[ ${quarto_r_content[@]} =~ ${CONTENT} ]]; then
        assert_output --partial "error detecting content type: quarto with knitr engine is not yet supported."
    else
        assert_success
    
    # add description
    perl -i -pe '$_ .= qq(description =  "'"${CONTENT}"' description"\n) if /title/' ${FULL_PATH}/.posit/publish/${CONTENT}.toml
    
    # add Connect metadata fields
    echo "
[connect]
runtime.connection-timeout = 25
runtime.read-timeout = 30
runtime.init-timeout = 35
runtime.idle-timeout = 40
runtime.max-processes = 2
runtime.min-processes = 1
runtime.max-connections = 5
runtime.load-factor = 0.8
" >> ${FULL_PATH}/.posit/publish/${CONTENT}.toml
    fi
}

# temporary unsupported quarto types
quarto_r_content=(
    "quarto-proj-r-shiny" "quarto-proj-r" "quarto-proj-r-py"
    "quarty-website-r" "quarto-website-r-py"
    "quarto-website-r-py-separate-files-deps" "quarto-website-r-deps"
    "quarto-website-r-py-deps"
)

quarto_content_types=(
    "quarto" "quarto-static"
)

python_content_types=(
    "python-dash" "python-fastapi" "python-shiny"
    "python-bokeh"  "python-streamlit" "python-flask"
    "jupyter-voila" "jupyter-static" "jupyter-notebook"
)
# create requirements files
@test "requirements create works as expected for ${CONTENT}" {
    if [[ ${python_content_types[@]} =~ ${CONTENT_TYPE} ]]; then
        mv ${FULL_PATH}/requirements.txt ${FULL_PATH}/temp.txt
        run ${EXE} requirements create ${FULL_PATH}/
        assert_success
        assert_line "Wrote file requirements.txt:"
    else
        skip
    fi
}

# verify requirements file has expected content
@test "requirements show works as expected for ${CONTENT}" {
    if [[ ${python_content_types[@]} =~ ${CONTENT_TYPE} ]]; then
        run ${EXE} requirements show ${FULL_PATH}/
        assert_success

        run diff <(grep -o '^[^=]*' ${FULL_PATH}/test/requirements.in | \
                grep -v '^#') <(grep -o '^[^=]*' ${FULL_PATH}/requirements.txt | \
                grep -v '^#')
        assert_success
    else
        skip
    fi
}

# deploy content with the env account using requirements files
@test "deploy ${CONTENT}" {
    init_with_fields
    run ${EXE} deploy ${FULL_PATH} -n ci_deploy -c ${CONTENT}

    deploy_assertion
}

# redeploy content from previous test
@test "redeploy ${CONTENT}" {

    run ${EXE} redeploy ci_deploy ${FULL_PATH}
    deploy_assertion

    # cleanup
    # rm -rf ${FULL_PATH}/.posit/
}

@test "check for toml file" {
    if [[ ${quarto_r_content[@]} =~ ${CONTENT} ]]; then
        skip
    else
        run cat ${FULL_PATH}/.posit/publish/deployments/ci_deploy.toml
            assert_output --partial "type = '${CONTENT_TYPE}'"
            assert_output --partial "entrypoint = '${ENTRYPOINT}'"
    fi
}

# verify error for missing requirements file
@test "deploy no requirements file" {
    if [[ ${python_content_types[@]} =~ ${CONTENT_TYPE} ]]; then
        rm -rf ${FULL_PATH}/requirements.txt
        run ${EXE} deploy ${FULL_PATH}
        assert_failure
        assert_output --partial "\
can't find the package file (requirements.txt) in the project directory.
Create the file, listing the packages your project depends on.
Or scan your project dependencies using the publisher UI or
the 'publisher requirements create' command."
    else
        skip
    fi
}

teardown_file() {
    # delete the temp files
    rm -rf ${FULL_PATH}/.posit*
}