#!/usr/bin/env bats

load '../node_modules/bats-support/load'
load '../node_modules/bats-assert/load'
source ../content/bundles/${CONTENT}/test/.publisher-env
CONTENT_PATH='../content/bundles'

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
            -H "Authorization: Key ${CONNECT_API_KEY}" "${CONNECT_SERVER}/__api__/v1/content/${GUID}"
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
        mv ${CONTENT_PATH}/${CONTENT}/requirements.txt ${CONTENT_PATH}/${CONTENT}/temp.txt
        run ${EXE} requirements create ${CONTENT_PATH}/${CONTENT}/
        assert_success
        assert_line "Wrote file requirements.txt:"
    else
        skip
    fi
}

# verify requirements file has expected content
@test "requirements show works as expected for ${CONTENT}" {
    if [[ ${python_content_types[@]} =~ ${CONTENT_TYPE} ]]; then
        run ${EXE} requirements show ${CONTENT_PATH}/${CONTENT}/
        assert_success
                
        run diff <(grep -o '^[^=]*' ${CONTENT_PATH}/${CONTENT}/test/requirements.in) <(grep -o '^[^=]*' ${CONTENT_PATH}/${CONTENT}/requirements.txt)
        assert_success
    else
        skip
    fi
}

# deploy content with the env account using requirements files
@test "deploy ${CONTENT}" {

    run ${EXE} deploy ${CONTENT_PATH}/${CONTENT} -n ci_deploy
    deploy_assertion
}

# redeploy content from previous test
@test "redeploy ${CONTENT}" {

    run ${EXE} redeploy ci_deploy ${CONTENT_PATH}/${CONTENT}
    deploy_assertion

    # cleanup
    rm -rf ${CONTENT_PATH}/${CONTENT}/.posit/ ${CONTENT_PATH}/${CONTENT}/.positignore
}

# verify error for missing requirements file
@test "deploy no requirements file" {
    rm -rf ${CONTENT_PATH}/${CONTENT}/requirements.txt
    run ${EXE} deploy ${CONTENT_PATH}/${CONTENT}
    assert_failure
    assert_output --partial "\
can't find the package file (requirements.txt) in the project directory.
Create the file, listing the packages your project depends on.
Or scan your project dependencies using the publisher UI or
the 'publisher requirements create' command."
}
