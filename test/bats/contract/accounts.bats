#!/usr/bin/env bats

load '../node_modules/bats-support/load'
load '../node_modules/bats-assert/load'

# list-accounts should return the account from env
@test "list accounts" {
    run ${EXE} list-accounts
    assert_success
    assert_output --partial "Nickname: \"env\""
    assert_output --partial "Configured via: CONNECT_SERVER environment variable"
    assert_output --partial "Authentication: Connect API key"
}

# test-account should pass with env
@test "test accounts" {
    run ${EXE} test-account env
    assert_success
    assert_output --partial "Name:     Administrator Smith"
    assert_output --partial "Username: admin"
    assert_output --partial "Email:    rsc@example.com"
}