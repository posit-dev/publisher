#* @get /
root <- function(){
  "hello world 2!1"
}

#* @get /mean
normalMean <- function(samples=10){
  data <- rnorm(samples)
  mean(data)
}