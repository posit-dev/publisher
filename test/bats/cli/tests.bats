#!/usr/bin/env bats

load '../node_modules/bats-support/load'
load '../node_modules/bats-assert/load'

@test "--help command succeeds" {
    run ${EXE} -h
    assert_success
}

@test "init creates expected file" {
    python_version="$(python --version | awk '{print $2}')"
    run ${EXE} init ../sample-content/fastapi-simple/
    assert_success
    run cat ../sample-content/fastapi-simple/.posit/publish/default.toml
    assert_line "type = 'python-fastapi'"
    assert_line "entrypoint = 'simple.py'"
    assert_line "validate = true"
    assert_line "title = 'fastapi-simple'"
    assert_line "version = '$python_version'"
    assert_line "package-file = 'requirements.txt'"
    assert_line "package-manager = 'pip'"
}
