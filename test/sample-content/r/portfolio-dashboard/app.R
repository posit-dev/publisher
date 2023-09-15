library(dplyr)
library(dygraphs)
library(plotly)
library(PerformanceAnalytics)
library(shiny)
library(shinydashboard)
library(xts)
library(zoo)

returns <- readRDS("returns.rds")
portfolio_choices <- c(
  "Conservative" = "conservative_portfolio_returns",
  "Balanced" = "balanced_portfolio_returns",
  "Aggressive" = "aggressive_portfolio_returns"
)

ui <- dashboardPage(
  dashboardHeader(title = "Portfolio Dashboard"),
  dashboardSidebar(
    selectInput(
      "portfolio",
      "Choose a portfolio",
      choices = portfolio_choices,
      selected = "balanced_portfolio_returns"
    ),
    dateInput(
      inputId = "date",
      label = "Starting Date",
      value = "2010-01-01",
      format = "yyyy-mm-dd"
    ),
    sliderInput("mar", "Min Acceptable Rate", min = 0, max = 0.1, value = 0.008, step = 0.001),
    numericInput("window", "Rolling Window", min = 6, max = 36, value = 12)
  ),
  dashboardBody(
    fluidRow(
      box(title = "Rolling Sortino", width = 12,
        plotlyOutput("time_series")
      )
    ),
    fluidRow(
      box(title = "Scatterplot", width = 4,
        plotlyOutput("scatterplot", height = 250)
      ),
      box(title = "Histogram", width = 4,
        plotlyOutput("histogram", height = 250)
      ),
      box(title = "Density", width = 4,
        plotlyOutput("density", height = 250)
      )
    )
  )
)

server <- function(input, output) {
  
  rate_limit_sec <- 2
  
  portfolio_selected <- throttle(reactive({
    req(input$portfolio, input$date)
    
    returns[[input$portfolio]] %>%
      as_tibble() %>%
      #collect() %>%
      mutate(date = as.Date(date)) %>%
      filter(date >= input$date)
    
  }), rate_limit_sec * 1000)
  
  rolling_sortino <- reactive({
    req(input$mar)
    req(input$window)
    
    portfolio_selected()$returns %>%
      xts::xts(order.by = portfolio_selected()$date) %>%
      rollapply(input$window, function(x) SortinoRatio(x, MAR = input$mar)) %>%
      `colnames<-`("24-rolling")
  })
  
  sortino_byhand <- reactive({
    portfolio_selected() %>%
      mutate(ratio = mean(returns - input$mar) / sqrt(sum(pmin(returns - input$mar, 0)^2) / nrow(.))) %>%
      # Add two new columns to help with ggplot.
      mutate(status = ifelse(returns < input$mar, "down", "up"))
  })
  
  output$time_series <- renderPlotly({
    plot_ly() %>%
      add_lines(x = index(rolling_sortino()), y = as.numeric(rolling_sortino())) %>%
      layout(
        hovermode = "x",
        xaxis = list(
          rangeslider = list(visible = TRUE),
          rangeselector = list(
            x = 0, y = 1, xanchor = 'left', yanchor = "top", font = list(size = 9),
            buttons = list(
              list(count = 1, label = 'RESET', step = 'all'),
              list(count = 1, label = '1 YR', step = 'year', stepmode = 'backward'),
              list(count = 3, label = '3 MO', step = 'month', stepmode = 'backward'),
              list(count = 1, label = '1 MO', step = 'month', stepmode = 'backward')
            )        
          )
        )
      )
  })
  
  output$scatterplot <- renderPlotly({
    portfolio_scatter <- ggplot(sortino_byhand(), aes(x = date, y = returns, color = status) )+
      geom_point() +
      geom_vline(xintercept = as.numeric(as.Date("2016-11-30")), color = "blue") +
      geom_hline(yintercept = input$mar, color = "purple", linetype = "dotted") +
      scale_color_manual(values = c("tomato", "chartreuse3")) +
      theme(legend.position = "none") + ylab("percent monthly returns")
    
    ggplotly(portfolio_scatter) %>% 
      add_annotations(
        text = "Trump", x = as.numeric(as.Date("2016-11-30")), 
        y = -.05, xshift = -10, textangle = -90, showarrow = FALSE
      )
  })
  
  output$histogram <- renderPlotly({
    p <- ggplot(sortino_byhand(), aes(x = returns)) +
      geom_histogram(alpha = 0.25, binwidth = .01, fill = "cornflowerblue") +
      geom_vline(xintercept = input$mar, color = "green")
    ggplotly(p) %>%
      add_annotations(text = "MAR", x = input$mar, y = 10, xshift = 10, showarrow = FALSE, textangle = -90)
  })
  
  output$density <- renderPlotly({
    sortino_density_plot <- ggplot(sortino_byhand(), aes(x = returns)) +
      stat_density(geom = "line", size = 1, color = "cornflowerblue")
    
    shaded_area_data <- ggplot_build(sortino_density_plot)$data[[1]] %>%
      filter(x < input$mar)
    
    sortino_density_plot <-
      sortino_density_plot +
      geom_area(data = shaded_area_data, aes(x = x, y = y), fill = "pink", alpha = 0.5) +
      geom_segment(
        data = shaded_area_data, aes(x = input$mar, y = 0, xend = input$mar, yend = y),
        color = "red", linetype = "dotted"
      )
    
    ggplotly(sortino_density_plot) %>%
      add_annotations(
        x = input$mar, y = 5, text = paste("MAR =", input$mar, sep = ""), textangle = -90
      ) %>%
      add_annotations(
        x = (input$mar - .02), y = .1, text = "Downside", 
        xshift = -20, yshift = 10, showarrow = FALSE
      )
  })
}

shinyApp(ui = ui, server = server)
