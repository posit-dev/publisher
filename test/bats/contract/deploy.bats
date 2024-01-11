#!/usr/bin/env bats

load '../node_modules/bats-support/load'
load '../node_modules/bats-assert/load'
source ../sample-content/python/${CONTENT}/.env

# deploy content with the env account
@test "deploy ${CONTENT}" {
    run ${EXE} deploy ../sample-content/python/${CONTENT} -n ci_deploy
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
    run ${EXE} redeploy ci_deploy ../sample-content/python/${CONTENT}
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
    run rm -rf ../sample-content/python/${CONTENT}/.posit/
}

teardown_file() {
    rm -rf ../sample-content/python/${CONTENT}/.posit
}
