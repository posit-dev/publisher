#!/usr/bin/env bats

load '/libs/bats-support/load'
load '/libs/bats-assert/load'

@test "${BINARY_PATH} list servers" {
    run ${BINARY_PATH} list-accounts
    assert_success
    assert_output --partial "No accounts are saved. To add an account, see \`connect-client add-server --help\`."
}