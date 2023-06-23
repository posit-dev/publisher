#!/usr/bin/env bats

load ${BATS_SUPPORT_LIB}
load ${BATS_ASSERT_LIB}

function setup() {
    . ./bats/server-tests/.server-asserts
}

@test "help" {
    run ${BINARY_PATH} --help
    assert_success
    assert_output --partial "$help"
}

@test "-h" {
    run ${BINARY_PATH} -h
    assert_success
    assert_output --partial "$help"
}

@test "help add account" {
    run ${BINARY_PATH} add-account --help
    assert_success
    assert_output --partial "$help_add_account"
}

@test "help publish" {
    run ${BINARY_PATH} publish --help
    assert_success
    assert_output --partial "$help_publish"
}