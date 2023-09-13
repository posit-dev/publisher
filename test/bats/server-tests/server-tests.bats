#!/usr/bin/env bats

load ${BATS_SUPPORT_LIB}
load ${BATS_ASSERT_LIB}

@test "${BINARY_PATH} list servers" {
    run ${BINARY_PATH} list-accounts
    assert_success
    assert_output --partial "No accounts are saved. To add an account, see \`publishing-client add-server --help\`."
}
