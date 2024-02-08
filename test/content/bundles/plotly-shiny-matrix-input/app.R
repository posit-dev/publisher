### Load packages

library(shiny)
library(tidyverse)
library(plotly)
library(shinyMatrix)

### Define default matrix

rateInputs_m <-
  matrix(
    c(0, 10, 15, 26, 29, 39, 70, 0.78, 1.05, 1.21, 0.67, 0.61, 0.67, 0.67),
    nrow = 7,
    ncol = 2,
    dimnames = list(NULL, c("Time", "Speed"))
  )

### Define UI
ui <- fluidPage(
  titlePanel("Plotly and Shiny Matrix Input Demonstration"),
  fluidRow(column(12,
                  h4("This is a demonstration of a tutorial created by ", a("Taylor Rodgers", href = "https://www.linkedin.com/in/taylor-rodgers-4b8632127/"), " on how to use shinyMatrix and plotly graphs as inputs in a Shiny app."),
                  h5("Want to create this yourself? ", a("Read the tutorial and find the code here!", href = "https://blog.rstudio.com/2021/09/29/how-to-use-shinymatrix-and-plotly-graphs/")),
                  hr())),
  fluidRow(
    column(
      4,
      radioButtons(
        "toggleInputSelect",
        "Input Method:",
        choices = c("Drag-and-Drop" = "dragDrop", "Hand Typed" =
                      "handTyped")
      ),
      br(),
      conditionalPanel(condition = "input.toggleInputSelect=='dragDrop'",
                       plotlyOutput("speed_p", height = "250px")),
      conditionalPanel(
        condition = "input.toggleInputSelect=='handTyped'",
        matrixInput(
          "rateInputs_mi",
          value = rateInputs_m,
          class = "numeric",
          row = list(names = FALSE)
        )
      )
    ),
    column(8,
           tabsetPanel(
             id = "tabs",
             tabPanel(
               "Algorithm Tab",
               value = "algorithmOutput",
               column(3, br(),
                      tags$h4("Original Values"),
                      tableOutput("table1")),
               column(3, br(),
                      tags$h4("Matix Inputs"),
                      tableOutput("table2")),
               column(3, br(),
                      tags$h4("Reactive Values"),
                      tableOutput("table3"))
             )
           ))
  )
)


### Define server logic
server <- function(input, output, session) {
  output$table1 <- renderTable({
    rateInputs_m
  })
  
  output$table2 <- renderTable({
    input$rateInputs_mi
  })
  
  output$table3 <- renderTable({
    req(rv$time)
    data.frame(rv$time, rv$speed)
    
  })
  
  # Creating Reactive Values
  rv <- reactiveValues(time = rateInputs_m[, 1],
                       speed = rateInputs_m[, 2])
  
  # Speed 1's Plot and Table and Feedback
  output$speed_p <- renderPlotly({
    speed_c <- map2(
      rv$time,
      rv$speed,
      ~ list(
        type = "circle",
        xanchor = .x,
        yanchor = .y,
        x0 = -4,
        x1 = 4,
        y0 = -4,
        y1 = 4,
        xsizemode = "pixel",
        ysizemode = "pixel",
        fillcolor = "grey",
        line = list(color = "black")
      )
    )
    
    
    plot_ly(source = "speed_s") %>%
      add_lines(x = rv$time,
                y = rv$speed,
                color = I("black")) %>%
      layout(
        shapes = speed_c,
        xaxis = list(title = "Time"),
        yaxis = list(title = "Speed"),
        showlegend = FALSE
      ) %>%
      config(edits = list(shapePosition = TRUE),
             displayModeBar = FALSE)
    
  })
  
  
  observeEvent(event_data(event = "plotly_relayout", source = "speed_s"), {
    # Speed 1 Event Data
    speed_ed <- event_data("plotly_relayout", source = "speed_s")
    speed_sa <-
      speed_ed[grepl("^shapes.*anchor$", names(speed_ed))]
    speed_ri <- unique(readr::parse_number(names(speed_sa)) + 1)
    speed_pts <- as.numeric(speed_sa)
    
    # Speed 1 Point Updates
    temp_matrix <- matrix(
      c(round(rv$time, 2), round(rv$speed, 2)),
      nrow = 7,
      ncol = 2,
      dimnames = list(NULL, c("Time", "Speed"))
    )
    temp_matrix[speed_ri, 1] <- round(speed_pts[1], 2)
    temp_matrix[speed_ri, 2] <- round(speed_pts[2], 2)
    temp_matrix <-
      temp_matrix[order(temp_matrix[, 1], decreasing = FALSE),]
    temp_matrix[1, 1] <- 0
    temp_matrix[7, 1] <- 70
    
    # Update reactive values
    rv$time <- round(temp_matrix[, 1], 2)
    rv$speed <- round(temp_matrix[, 2], 2)
    
    updateMatrixInput(session, "rateInputs_mi", temp_matrix)
    
  })
  
  observeEvent(req(input$rateInputs_mi &
                     input$toggleInputSelect == "handTyped"),
               {
                 temp_matrix <-
                   matrix(
                     input$rateInputs_mi,
                     nrow = 7,
                     ncol = 2,
                     dimnames = list(NULL, c("Time", "Speed"))
                   )
                 temp_matrix[1, 1] <- 0
                 temp_matrix[7, 1] <- 70
                 temp_matrix <-
                   temp_matrix[order(temp_matrix[, 1], decreasing = FALSE),]
                 
                 rv$time <- temp_matrix[, 1]
                 rv$speed <- temp_matrix[, 2]
                 
                 updateMatrixInput(session, "rateInputs_mi", temp_matrix)
                 
               })
  
}

### Run the application
shinyApp(ui = ui, server = server)