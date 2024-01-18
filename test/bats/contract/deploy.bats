#!/usr/bin/env bats

load '../node_modules/bats-support/load'
load '../node_modules/bats-assert/load'
source ../bundles/${CONTENT}/test/.publisher-env
CONTENT_PATH='../bundles/'

# these python apis cannot be detected by publisher
# known issue #794


# deploy content with the env account
@test "deploy ${CONTENT}" {
    if [[ ${CONTENT} == *"quart"* || ${CONTENT} == *"pycnic"* || ${CONTENT} == *"bottle"* ]]; then
        skip "${CONTENT} can't be detected - #794"
    fi
    run ${EXE} deploy ${CONTENT_PATH}/${CONTENT} -n ci_deploy
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
}

# redeploy content from previous test
@test "redeploy ${CONTENT}" {
    if [[ ${CONTENT} == *"quart"* || ${CONTENT} == *"pycnic"* || ${CONTENT} == *"bottle"* ]]; then
        skip "${CONTENT} can't be detected - #794"
    fi
    run ${EXE} redeploy ci_deploy ${CONTENT_PATH}${CONTENT}
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
    # cleanup
    run rm -rf ${CONTENT_PATH}${CONTENT}/.posit/ ${CONTENT_PATH}${CONTENT}/.positignore
}
