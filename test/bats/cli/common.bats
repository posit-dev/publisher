#!/usr/bin/env bats

load '../node_modules/bats-support/load'
load '../node_modules/bats-assert/load'

@test "--help command succeeds" {
    run ${EXE} -h
    assert_success
}
