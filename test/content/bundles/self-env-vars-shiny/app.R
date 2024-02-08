#
# This is a Shiny web application. You can run the application by clicking
# the 'Run App' button above.
#
# Find out more about building applications with Shiny here:
#
#    http://shiny.rstudio.com/
#

library(shiny)

product <- Sys.getenv("RSTUDIO_PRODUCT", "ENV variable not found")
guid <- Sys.getenv("CONNECT_CONTENT_GUID", "ENV variable not found")
shinyApp(
    ui = basicPage(
        tags$h3("Self Identifying Environment Variables within Connect"),
        hr(),
        tags$h5("RSTUDIO_PRODUCT"),
        textOutput("product"),
        hr(),
        tags$h5("CONNECT_CONTENT_GUID"),
        textOutput("guid")
    ),
    server = function(input, output) {
        output$product <- renderText({ product })
        output$guid <- renderText({ guid })
    }
)
