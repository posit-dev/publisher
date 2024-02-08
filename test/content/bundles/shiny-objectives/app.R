# INITIALIZATIONS -----------------------------

library(shiny)
library(rhandsontable)

# UI -----------------------------------
ui <- fluidPage(
  fluidRow(rHandsontableOutput('objective_table'))
)


# SERVER ---------------------
server <- function(input, output, session) {
  
  # EXAMPLE TABLE -----------------
  
  output$objective_table <- renderRHandsontable({
    
    starting_table = data.frame(Objectives = rep('', 4))
    
    interactive_tbl = rhandsontable(starting_table, stretchH = "all")
    
    interactive_tbl
  })
} 


# Create Shiny object
shinyApp(ui = ui, server = server)