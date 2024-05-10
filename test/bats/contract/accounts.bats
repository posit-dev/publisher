#!/usr/bin/env bats

load '../node_modules/bats-support/load'
load '../node_modules/bats-assert/load'

# list-accounts should return the account from env
# @test "list accounts" {
#     run ${EXE} list-accounts
#     assert_success
#     assert_line -p "Nickname: \"env\""
#     assert_line -p "Configured via: CONNECT_SERVER environment variable"
#     assert_line -p "Authentication: Connect API key"
# }

# test-account should pass with env
# @test "test accounts" {
#     run ${EXE} test-account env
#     assert_success
#     assert_line -p "Name:     Administrator Smith"
#     assert_line -p "Username: admin"
#     assert_line -p "Email:    rsc@example.com"
# }

@test "list accounts with no account" {
    unset CONNECT_SERVER
    run ${EXE} list-accounts
    assert_success
    assert_line "No accounts found. Use rsconnect or rsconnect-python to register an account."
}

@test "list accounts no API KEY" {
    unset CONNECT_API_KEY
    run ${EXE} list-accounts
    assert_success
    assert_line -p "Authentication: No saved credentials"
}

# tempoarily add the server with rsconnect-python
# @test "add the server and use it" {
#     run rsconnect add -n ci-test -s $CONNECT_SERVER -k $CONNECT_API_KEY
#     unset CONNECT_SERVER
#     unset CONNECT_API_KEY
#     run ${EXE} list-accounts
#     assert_line -p "Nickname: \"ci-test\""
#     assert_line -p "Configured via: rsconnect-python"
#     assert_line -p "Authentication: Connect API key"
# }

teardown() {
    run rsconnect remove -n ci-test
}
