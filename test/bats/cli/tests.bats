#!/usr/bin/env bats

load '../node_modules/bats-support/load'
load '../node_modules/bats-assert/load'
source ../content/bundles/${CONTENT}/test/.publisher-env
CONTENT_PATH='../content/bundles'

@test "--help command succeeds" {
    run ${EXE} -h
    assert_success
}

# @test "init creates expected file" {
#     python_version="$(python --version | awk '{print $2}')"
#     run ${EXE} init ../sample-content/fastapi-simple/
#     assert_success
#     run cat ../sample-content/fastapi-simple/.posit/publish/default.toml
#     assert_line "type = 'python-fastapi'"
#     assert_line "entrypoint = 'simple.py'"
#     assert_line "validate = true"
#     assert_line "title = 'fastapi-simple'"
#     assert_line "version = '$python_version'"
#     assert_line "package-file = 'requirements.txt'"
#     assert_line "package-manager = 'pip'"
# }

python_content_types=(
    "python-flask"  "python-fastapi"  "python-shiny"
     "python-bokeh"  "python-streamlit"  "python-flask"
     "jupyter-voila" "jupyter-static"
)

quarto_content_types=(
    "quarto" "quarto-static"
)

@test "init creates expected file for ${CONTENT}" {
    python_version="$(python --version | awk '{print $2}')"
    quarto_version="$(quarto --version)"

    run ${EXE} init ${CONTENT_PATH}/${CONTENT}
    assert_success
    assert_line "Created config file '${CONTENT_PATH}/${CONTENT}/.posit/publish/default.toml'"

    run cat ${CONTENT_PATH}/${CONTENT}/.posit/publish/default.toml
    assert_success
    if [[ ${quarto_r_content[@]} =~ ${CONTENT} ]]; then
        skip "${CONTENT} is not yet supported"
    else
        assert_line "type = '${CONTENT_TYPE}'"
        assert_line "entrypoint = '${ENTRYPOINT}'"
        assert_line "validate = true"
        assert_line "title = '${TITLE}'"
        if [[ ${python_content_type[@]} =~ ${CONTENT_TYPE} ]]; then
            assert_line "version = '${python_version}'"
            assert_line "package-file = 'requirements.txt'"
            assert_line "package-manager = 'pip'"
        elif [[ ${quarto_content_types[@]} =~ ${CONTENT_TYPE} ]]; then
            assert_line "version = '${quarto_version}'"
            assert_line "engines = ['${QUARTO_ENGINE}']"
            # if python check python version
            if [[ "py" =~ ${CONTENT_TYPE} ]]; then
                assert_line "version = '${python_version}'"
            fi
        fi 
    fi
}

teardown() {
    rm -rf ${CONTENT_PATH}/${CONTENT}/.posit/
}
