#!/usr/bin/env bats

load '../node_modules/bats-support/load'
load '../node_modules/bats-assert/load'

@test "--help command succeeds" {
    run ${EXE} -h
    assert_success
    assert_line "  -h, --help           Show context-sensitive help."
    assert_line "  -v, --verbose=INT    Enable verbose logging. Use -vv or --verbose=2 for debug"
    assert_line "  init [<path>]"
    assert_line "  deploy [<path>]"
    assert_line "  redeploy <deployment-name> [<path>]"
    assert_line "  ui [<path>]"
    assert_line "  requirements create [<path>]"
    assert_line "  requirements show [<path>]"
    assert_line "  version"
    assert_line --partial "<command> --help\" for more information on a command."
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
    assert_line "  -h, --help             Show context-sensitive help."
    assert_line "  -v, --verbose=INT      Enable verbose logging. Use -vv or --verbose=2 for"
    assert_line "      --python=PATH      Path to Python interpreter for this content, if it is"
    assert_line "  -c, --config=STRING    Configuration name to create (in .posit/publish/)"
}

@test "deploy --help command succeeds" {
    run ${EXE} deploy -h
    assert_success
    assert_line "  [<path>]    Path to project directory containing files to publish."
    assert_line "  -h, --help              Show context-sensitive help."
    assert_line "  -v, --verbose=INT       Enable verbose logging. Use -vv or --verbose=2 for"
    assert_line "  -a, --account=STRING    Nickname of the publishing account to use (run"
    assert_line "  -c, --config=STRING     Configuration name (in .posit/publish/)"
    assert_line "  -n, --name=STRING       Save deployment with this name (in"
}

@test "redeploy --help command succeeds" {
    run ${EXE} redeploy -h
    assert_success
    assert_line "  <deployment-name>    Name of deployment to update (in .posit/deployments/)"
    assert_line "  [<path>]             Path to project directory containing files to publish."
    assert_line "  -h, --help             Show context-sensitive help."
    assert_line "  -v, --verbose=INT      Enable verbose logging. Use -vv or --verbose=2 for"
    assert_line "  -c, --config=STRING    Configuration name (in .posit/publish/)"
}

@test "ui --help command succeeds" {
    run ${EXE} ui -h
    assert_success
    assert_line "  -h, --help                    Show context-sensitive help."
    assert_line "  -v, --verbose=INT             Enable verbose logging. Use -vv or --verbose=2"
    assert_line "  -i, --interactive             Launch a browser to show the UI."
    assert_line "      --listen=HOST[:PORT]      Network address to listen on."
    assert_line "      --tls-key-file=STRING     Path to TLS private key file for the UI server."
    assert_line "      --tls-cert-file=STRING    Path to TLS certificate chain file for the UI"
}

@test "requirements create --help command succeeds" {
    run ${EXE} requirements create -h
    assert_success
    assert_line "  [<path>]    Path to project directory containing files to publish."
    assert_line "  -h, --help           Show context-sensitive help."
    assert_line "  -v, --verbose=INT    Enable verbose logging. Use -vv or --verbose=2 for debug"
    assert_line "      --python=PATH    Path to Python interpreter for this content, if it is"
    assert_line "                       Python-based. Default is the Python 3 on your PATH."
    assert_line "  -o, --output=\"requirements.txt\""
    assert_line "  -f, --force          Overwrite the output file, if it exists."
}

@test "requirements show --help command succeeds" {
    run ${EXE} requirements show -h
    assert_success
    assert_line "  [<path>]    Path to project directory containing files to publish."
    assert_line "  -h, --help           Show context-sensitive help."
    assert_line "  -v, --verbose=INT    Enable verbose logging. Use -vv or --verbose=2 for debug"
    assert_line "      --python=PATH    Path to Python interpreter for this content, if it is"
    assert_line "                       Python-based. Default is the Python 3 on your PATH."
}

@test "test version" {
    run ${EXE} version
    assert_success
}

@test "test missing command" {
    run ${EXE}
    assert_failure
    assert_line --partial 'expected one of "credentials",  "deploy",  "init",  "redeploy",  "requirements",  ...'
}
