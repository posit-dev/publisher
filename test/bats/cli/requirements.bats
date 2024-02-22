#!/usr/bin/env bats

load '../node_modules/bats-support/load'
load '../node_modules/bats-assert/load'
source ../content/bundles/${CONTENT}/test/.publisher-env
CONTENT_PATH='../content/bundles'

python_content_types=(
    "python-dash" "python-flask"  "python-fastapi"  "python-shiny"
     "python-bokeh"  "python-streamlit"  "python-flask"
     "jupyter-voila" "jupyter-static" "jupyter-notebook"
)

@test "requirements create works as expected for ${CONTENT}" {
    if [[ ${python_content_types[@]} =~ ${CONTENT_TYPE} ]]; then
        mv ${CONTENT_PATH}/${CONTENT}/requirements.txt ${CONTENT_PATH}/${CONTENT}/temp.txt
        run ${EXE} requirements create ${CONTENT_PATH}/${CONTENT}/
        assert_success
        assert_line "Wrote file requirements.txt:"
    else
        skip
    fi
}

@test "requirements show works as expected for ${CONTENT}" {
    if [[ ${python_content_types[@]} =~ ${CONTENT_TYPE} ]]; then
        run ${EXE} requirements show ${CONTENT_PATH}/${CONTENT}/
        assert_success
                
        run diff <(grep -o '^[^=]*' ${CONTENT_PATH}/${CONTENT}/test/requirements.in) <(grep -o '^[^=]*' ${CONTENT_PATH}/${CONTENT}/requirements.txt)
        assert_success
    else
        skip
    fi
}

# teardown() {
#     rm -rf ${CONTENT_PATH}/${CONTENT}/.posit/
# }
