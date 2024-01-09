#!/usr/bin/env bats

load '../node_modules/bats-support/load'
load '../node_modules/bats-assert/load'

@test "list accounts" {
    run ${EXE} list-accounts
    assert_success
    assert_output --partial "Nickname: \"env\""
    assert_output --partial "Configured via: CONNECT_SERVER environment variable"
    assert_output --partial "Authentication: Connect API key"
}

@test "deploy content" {
    run ${EXE} deploy ../sample-content/fastapi-simple/
    assert_success
    assert_output --partial "Test Deployment...                 [OK]"
    # now test the deployment via api
    GUID="$(echo "${output}" | \
        grep "Direct URL:" | \
        grep -o -E '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')"
    run curl --silent --show-error -L --max-redirs 0 --fail \
        -X GET \
        -H "Authorization: Key ${CONNECT_API_KEY}" "${CONNECT_SERVER}/__api__/v1/content/${GUID}"
    assert_output --partial "\"app_mode\":\"python-fastapi\""
}

# @test "pwd" {
#     run ls ../
#     assert_output --partial "blue"
# }