#!/usr/bin/env bats

load '../node_modules/bats-support/load'
load '../node_modules/bats-assert/load'
source ../content/bundles/${CONTENT}/test/.publisher-env
CONTENT_PATH='../content/bundles'
FULL_PATH="${CONTENT_PATH}/${CONTENT}"

IGNORE_ROOT_FILE="ignoreme.txt"
IGNORE_WILDCARD="wildcard.wild"
IGNORE_SUBDIR_FILE="tempdir/subdir.txt"
IGNORE_SUBDIR_WILDCARD="tempdir/wildcard.wild"
IGNORE_SUBDIR_DBL_WILDCARD="tempdir/subdir/subdirdbl.wild"

setup_file() {
    # make subdirectories and files for positignore testing
    mkdir ${FULL_PATH}/tempdir
    mkdir ${FULL_PATH}/tempdir/subdir
    touch ${FULL_PATH}/${IGNORE_ROOT_FILE}
    touch ${FULL_PATH}/${IGNORE_WILDCARD}
    touch ${FULL_PATH}/${IGNORE_SUBDIR_FILE}
    touch ${FULL_PATH}/${IGNORE_SUBDIR_WILDCARD}
    touch ${FULL_PATH}/${IGNORE_SUBDIR_DBL_WILDCARD}

    touch ${FULL_PATH}/.positignore
    POSIT_IGNORE=${FULL_PATH}/.positignore
    # add each case to .positignore
    echo ${IGNORE_ROOT_FILE} >> ${POSIT_IGNORE}
    echo ${IGNORE_SUBDIR_FILE} >> ${POSIT_IGNORE}
    echo "*.wild" >> ${POSIT_IGNORE}
    echo "/tempdir/*.wild" >> ${POSIT_IGNORE}
    echo "/tempdir/**/*.wild" >> ${POSIT_IGNORE}
}

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

        run diff <(grep -o '^[^=]*' ${FULL_PATH}/test/requirements.in | grep -v '^#') <(grep -o '^[^=]*' ${FULL_PATH}/requirements.txt | grep -v '^#')
        assert_success
    else
        skip
    fi
}

# deploy content with the env account using requirements files
@test "deploy ${CONTENT}" {

    run ${EXE} deploy ${FULL_PATH} -n ci_deploy
    deploy_assertion
}

# redeploy content from previous test
@test "redeploy ${CONTENT}" {

    run ${EXE} redeploy ci_deploy ${FULL_PATH}
    deploy_assertion

    # cleanup
    # rm -rf ${FULL_PATH}/.posit/ ${FULL_PATH}/.positignore
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

@test "check for ignored files in toml" {
    if [[ ${quarto_r_content[@]} =~ ${CONTENT} ]]; then
        skip
    else
        run cat ${FULL_PATH}/.posit/publish/deployments/ci_deploy.toml
            refute_output --partial "${IGNORE_ROOT_FILE}"
            refute_output --partial "${IGNORE_WILDCARD}"
            refute_output --partial "${IGNORE_SUBDIR_FILE}"
            refute_output --partial "${IGNORE_SUBDIR_WILDCARD}"
            refute_output --partial "${IGNORE_SUBDIR_DBL_WILDCARD}"

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
    rm -rf ${FULL_PATH}/tempdir
    rm -rf ${FULL_PATH}/${IGNORE_ROOT_FILE}
    rm -rf ${FULL_PATH}/${IGNORE_WILDCARD}
    rm -rf ${FULL_PATH}/${IGNORE_SUBDIR_FILE}
    rm -rf ${FULL_PATH}/${IGNORE_SUBDIR_WILDCARD}
    rm -rf ${FULL_PATH}/${IGNORE_SUBDIR_DBL_WILDCARD}
}