#!/usr/bin/env bats

load '../node_modules/bats-support/load'
load '../node_modules/bats-assert/load'
source ../content/bundles/${CONTENT}/test/.publisher-env
CONTENT_PATH='../content/bundles'

# temporary unsupported quarto types
quarto_r_content=(
    "quarto-proj-r-shiny" "quarto-proj-r" "quarto-proj-r-py" 
    "quarty-website-r" "quarto-website-r-py" 
    "quarto-website-r-py-separate-files-deps" "quarto-website-r-deps"
    "quarto-website-r-py-deps"
    )

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

    if [[ ${quarto_r_content[@]} =~ ${CONTENT} ]]; then
        skip "${CONTENT} is not yet supported"
    else
        # init against content should create default.toml
        run ${EXE} init ${CONTENT_PATH}/${CONTENT}
        assert_success
        assert_output --partial "Created config file"

        # the default.toml should have the expected fields
        run cat ${CONTENT_PATH}/${CONTENT}/.posit/publish/default.toml
        assert_success
        # quarto + r content is not yet supported
        if [[ ${quarto_r_content[@]} =~ ${CONTENT} ]]; then
            skip "${CONTENT} is not yet supported"
        else
            assert_line "type = '${CONTENT_TYPE}'"
            assert_line "entrypoint = '${ENTRYPOINT}'"
            assert_line "validate = true"
            assert_line "title = '${TITLE}'"
            # for python content we create a toml with python version
            if [[ ${python_content_type[@]} =~ ${CONTENT_TYPE} ]]; then
                assert_line "version = '${python_version}'"
                assert_line "package-file = 'requirements.txt'"
                assert_line "package-manager = 'pip'"
            # for quarto content we create a toml with quarto version    
            elif [[ ${quarto_content_types[@]} =~ ${CONTENT_TYPE} ]]; then
                assert_line "version = '${quarto_version}'"
                assert_line "engines = ['${QUARTO_ENGINE}']"
                # quarto + python content has 'py' in its name
                # test python version for quarto + python content too
                if [[ "py" =~ ${CONTENT_TYPE} ]]; then
                    assert_line "version = '${python_version}'"
                fi
            fi
        fi 
    fi
}

teardown() {
    rm -rf ${CONTENT_PATH}/${CONTENT}/.posit/
}
