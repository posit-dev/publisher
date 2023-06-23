#!/usr/bin/env bats

load ${BATS_SUPPORT_LIB}
load ${BATS_ASSERT_LIB}

function setup() {
    . ./bats/deploy-tests/.deploy-asserts
    api_key=$(echo -n admin | md5sum | cut -f1 -d" ")
    server=http://localhost:3939
    pwd
    cp ~/Library/Application\ Support/rsconnect-python/servers-backup.json ~/Library/Application\ Support/rsconnect-python/servers.json
}

@test "publish notebook" {
    run ${BINARY_PATH} publish ./content/simple-notebook/simple-notebook.ipynb -n localhost
    assert_success
}

# @test "version" {
#     run ${BINARY_PATH} --version
#     assert_success
#     assert_output --partial "$version"
# }

# @test "add account" {
#     run ${BINARY_PATH} add-account -n localhost -u ${server} -k ${api_key}
#     assert_success
#     assert_output --partial ""
# }

function teardown() {
    rm -rf ~/Library/Application\ Support/rsconnect-python/servers.json
}