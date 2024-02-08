#
# This is a Plumber API. You can run the API by clicking
# the 'Run API' button above.
#
# Find out more about building APIs with Plumber here:
#
#    https://www.rplumber.io/
#

library(plumber)

#* @apiTitle Plumber Example API

#* Query the environment variables
#* @get /vars
function() {
    product <- Sys.getenv("RSTUDIO_PRODUCT", "ENV variable not found")
    guid <- Sys.getenv("CONNECT_CONTENT_GUID", "ENV variable not found")
    list(msg = paste0("RSTUDIO_PRODUCT: '", product, "', ", "CONNECT_CONTENT_GUID: '", guid, "'"))
}


