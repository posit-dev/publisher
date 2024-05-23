#!/usr/bin/env bats

load '../node_modules/bats-support/load'
load '../node_modules/bats-assert/load'

@test "--help command succeeds" {
    run ${EXE} -h
    assert_success
    assert_line --partial "-h, --help"
    assert_line --partial "-v, --verbose"
    assert_line --partial "credentials create <name> <url> <api-key>"
    assert_line --partial "credentials delete <guid>"
    assert_line --partial "credentials get <guid>"
    assert_line --partial "credentials list"
    assert_line --partial "deploy [<path>]"
    assert_line --partial "init [<path>]"
    assert_line --partial "redeploy <deployment-name> [<path>]"
    assert_line --partial "requirements create [<path>]"
    assert_line --partial "requirements show [<path>]"
    assert_line --partial "ui [<path>]"
    assert_line --partial "version"
}

@test "credentials --help command succeeds" {
    run ${EXE} credentials -h
}

@test "credentials create --help command succeeds" {
    run ${EXE} credentials create -h
}

@test "credentials delete --help command succeeds" {
    run ${EXE} credentials delete -h
}

@test "credentials --help get command succeeds" {
    run ${EXE} credentials get -h
}

@test "credentials list --help command succeeds" {
    run ${EXE} credentials list -h
}

@test "init --help command succeeds" {
    run ${EXE} init -h
    assert_success
    assert_line "  [<path>]    Path to project directory containing files to publish."
    assert_line --partial "-h, --help"
    assert_line --partial "-v, --verbose"
    assert_line --partial "--python=PATH"
    assert_line --partial "-c, --config=STRING"
}

@test "deploy --help command succeeds" {
    run ${EXE} deploy -h
    assert_success
    assert_line "  [<path>]    Path to project directory containing files to publish."
    assert_line --partial "-h, --help"
    assert_line --partial "-v, --verbose"
    assert_line --partial "-a, --account=STRING"
    assert_line --partial "-c, --config=STRING"
    assert_line --partial "-n, --name=STRING"
}

@test "redeploy --help command succeeds" {
    run ${EXE} redeploy -h
    assert_success
    assert_line "  <deployment-name>    Name of deployment to update (in .posit/deployments/)"
    assert_line "  [<path>]             Path to project directory containing files to publish."
    assert_line --partial "-h, --help"
    assert_line --partial "-v, --verbose"
    assert_line --partial "-c, --config=STRING"
}

@test "ui --help command succeeds" {
    run ${EXE} ui -h
    assert_success
    assert_line --partial "-h, --help"
    assert_line --partial "-v, --verbose"
    assert_line --partial "-i, --interactive"
    assert_line --partial "--listen=HOST[:PORT]"
    assert_line --partial "--tls-key-file=STRING"
    assert_line --partial "--tls-cert-file=STRING"
}

@test "requirements create --help command succeeds" {
    run ${EXE} requirements create -h
    assert_success
    assert_line "  [<path>]    Path to project directory containing files to publish."
    assert_line --partial "-h, --help"
    assert_line --partial "-v, --verbose"
    assert_line --partial "--python=PATH"
    assert_line --partial "-o, --output=\"requirements.txt\""
    assert_line --partial "-f, --force"
}

@test "requirements show --help command succeeds" {
    run ${EXE} requirements show -h
    assert_success
    assert_line "  [<path>]    Path to project directory containing files to publish."
    assert_line --partial "-h, --help"
    assert_line --partial "-v, --verbose"
    assert_line --partial "--python=PATH"
}

@test "test version" {
    run ${EXE} version
    assert_success
}

@test "test missing command" {
    run ${EXE}
    assert_failure
    assert_line --partial 'publisher: error: expected one of "credentials",  "deploy",  "init",  "redeploy",  "requirements",  ...'
}
