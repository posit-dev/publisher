library(shiny)

# Define UI for application that draws a histogram
ui <- fluidPage(

    # Application title
    titlePanel("Who am I?"),
    code("Sys.info()"),
    verbatimTextOutput("Sys.info"),
    code("Sys.getenv()"),
    verbatimTextOutput("USER"),
    code("system2(\"whoami\")"),
    verbatimTextOutput("whoami")
    )


# Define server logic required to draw a histogram
server <- function(input, output) {
  output$Sys.info <- renderPrint(Sys.info())
  
  user_vars <- list()
  user_vars$LOGNAME <- Sys.getenv("LOGNAME")
  user_vars$USER <- Sys.getenv("USER")
  user_vars$LNAME <- Sys.getenv("LNAME")
  user_vars$USERNAME <- Sys.getenv("USERNAME")
  output$USER <- renderPrint(user_vars)
  
  output$whoami <- renderPrint(system2("whoami", stdout = TRUE, stderr = TRUE))
}

# Run the application 
shinyApp(ui = ui, server = server)

