# plumber.R - API Definition File
# This file defines the API endpoints

library(plumber)

#* @apiTitle Simple Plumber API
#* @apiDescription A basic example of a Plumber API with various endpoints

#* Echo back the input
#* @param msg The message to echo
#* @get /echo
function(msg = "") {
  list(msg = paste0("The message is: '", msg, "'"))
}

#* Return current time
#* @get /time
function() {
  list(time = Sys.time())
}

#* Add two numbers
#* @param a First number
#* @param b Second number
#* @get /add
function(a, b) {
  a <- as.numeric(a)
  b <- as.numeric(b)
  list(result = a + b)
}
