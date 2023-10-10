#!/usr/bin/env bats

load '../node_modules/bats-support/load'
load '../node_modules/bats-assert/load'

@test "${EXE} -h" {
    run ${EXE} -h
    assert_success
}
