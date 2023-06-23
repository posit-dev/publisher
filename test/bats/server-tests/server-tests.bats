#!/usr/bin/env bats

load ${BATS_SUPPORT_LIB}
load ${BATS_ASSERT_LIB}

function setup() {
    . ./bats/server-tests/.server-asserts
    api_key=$(echo -n admin | md5sum | cut -f1 -d" ")
    server=http://localhost:3939
}

@test "list servers" {
    run ${BINARY_PATH} list-accounts
    assert_success
    assert_output --partial "No accounts are saved. To add an account, see \`connect-client add-server --help\`."
}

@test "version" {
    run ${BINARY_PATH} --version
    assert_success
    assert_output --partial "$version"
}

# @test "add account" {
#     run ${BINARY_PATH} add-account -n localhost -u ${server} -k ${api_key}
#     assert_success
#     assert_output --partial ""
# }