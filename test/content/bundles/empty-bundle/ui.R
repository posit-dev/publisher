library(shiny)
shinyUI(fluidPage(
  titlePanel("Hello Shiny!"),
  sidebarLayout(
    sidebarPanel("sidebar"),
    mainPanel("main")
  )
))
