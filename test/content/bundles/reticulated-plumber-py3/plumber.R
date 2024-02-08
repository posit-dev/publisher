library(reticulate)

#* @get /
index <- function() {
    "this is the index"
}

py_run_string("
def hello(name: str):
    return 'Hello %s!' % name
")

#* @get /hello
hello <- function(name = "World") {
    py$hello(name)
}
