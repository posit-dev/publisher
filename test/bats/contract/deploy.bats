#!/usr/bin/env bats

load '../node_modules/bats-support/load'
load '../node_modules/bats-assert/load'
source ../content/bundles/${CONTENT}/test/.publisher-env
CONTENT_PATH='../content/bundles/'

quarto_r_content=(
    "quarto-proj-r-shiny" "quarto-proj-r" "quarto-proj-r-py" 
    "quarty-website-r" "quarto-website-r-py" 
    "quarto-website-r-py-separate-files-deps" "quarto-website-r-deps"
    "quarto-website-r-py-deps"
    )

# deploy content with the env account
@test "deploy ${CONTENT}" {

    run ${EXE} deploy ${CONTENT_PATH}/${CONTENT} -n ci_deploy
    if [[ ${quarto_r_content[@]} =~ ${CONTENT} ]]; then
        assert_output --partial "error detecting content type: quarto with knitr engine is not yet supported."
    else
        assert_success
        assert_output --partial "Test Deployment...                 [OK]"
        # now test the deployment via api
        GUID="$(echo "${output}" | \
            grep "Direct URL:" | \
            grep -o -E '[0-9a-f-]{36}')"
        run curl --silent --show-error -L --max-redirs 0 --fail \
            -X GET \
            -H "Authorization: Key ${CONNECT_API_KEY}" "${CONNECT_SERVER}/__api__/v1/content/${GUID}"
        assert_output --partial "\"app_mode\":\"${CONTENT_TYPE}\""
    fi

}

# redeploy content from previous test
@test "redeploy ${CONTENT}" {

    run ${EXE} redeploy ci_deploy ${CONTENT_PATH}${CONTENT}
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
        assert_output --partial "\"app_mode\":\"${CONTENT_TYPE}\""

        run curl --silent --show-error -L --max-redirs 0 --fail \
            -X GET \
            -H "Authorization: Key ${CONNECT_API_KEY}" "${CONNECT_SERVER}/__api__/v1/content/${GUID}"
        assert_output --partial "\"app_mode\":\"${CONTENT_TYPE}\""
    fi

    # cleanup
    run rm -rf ${CONTENT_PATH}${CONTENT}/.posit/ ${CONTENT_PATH}${CONTENT}/.positignore
}
