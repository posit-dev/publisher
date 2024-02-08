#
# This is the server logic of a Shiny web application. You can run the
# application by clicking 'Run App' above.
#
# Find out more about building applications with Shiny here:
#
#    http://shiny.rstudio.com/
#

suppressPackageStartupMessages({
  library(shiny)
  library(shinydashboard)
  library(ggplot2)
  library(shimmer)
  library(shinycssloaders)
  library(magrittr)
  library(dplyr, include.only = "n")
  box <- shinydashboard::box
})



# Define server logic required to draw a histogram
shinyServer(function(session, input, output) {


  params_default <- yaml::read_yaml("config.yml")[["default"]]

  # User tab ----

  output$user_plot <- renderPlot({

    shape <- input[["user_shape"]]
    mean <- input[["user_mean"]]

    plot_limits <- c(
      defaults$ui$users$user_mean$min,
      defaults$ui$users$user_mean$max
    )
    dat <- data.frame(x = agamma(1e4, shape = shape, mean = mean))
    ggplot(dat, aes(x)) +
      geom_histogram(binwidth = 1) +
      coord_cartesian(xlim = plot_limits) +
      ggtitle("Arrival of new users", subtitle = "Distribution") +
      xlab("Time")
  })

  output[["request_plot"]] <- renderPlot({
    shape <- input[["request_shape"]]
    mean <- input[["request_mean"]]

    plot_limits <- c(
      defaults$ui$users$request_mean$min,
      defaults$ui$users$request_mean$max
    )
    dat <- data.frame(x = agamma(1e4, shape = shape, mean = mean))
    ggplot(dat, aes(x)) +
      geom_histogram(binwidth = 1) +
      coord_cartesian(xlim = plot_limits) +
      ggtitle("Arrival of new requests", subtitle = "Distribution") +
      xlab("Time")
  })




  # Dashboard tab ----

  adaptiveValueBox <- function(value, subtitle, as_percent = FALSE, icon = NULL,
                               colors = c("blue", "orange", "red"),
                               thresholds, reverse = FALSE, width = 4, href = NULL)
  {
    to_percent <- function(x) sprintf("%1.1f%%", x * 100)
    if (reverse) colors <- rev(colors)
    color <- dplyr::case_when(
      value <= thresholds[1] ~ colors[1],
      value >= thresholds[1] && value <= thresholds[2] ~ colors[2],
      value >= thresholds[2] ~ colors[3]
    )
    if (as_percent) value <- to_percent(value)
    shinydashboard::valueBox(value = value, subtitle = subtitle, icon = icon,
                             color = color, width = width, href = href)

  }

  observeEvent(input$switch_to_app, {
    updateTabItems(session, "sidebar_tabs", "app")
  })
  observeEvent(input$switch_to_users, {
    updateTabItems(session, "sidebar_tabs", "users")
  })
  observeEvent(input$switch_to_simulation, {
    updateTabItems(session, "sidebar_tabs", "simulation")
  })

  observeEvent(input[["go_button"]], {
    params <- reactive({
      modifyList(
        params_default,
        list(
          user = list(
            arrival = list(
              mean = input[["user_mean"]],
              shape = input[["user_shape"]]
            ),
            number_of_requests_per_user = input[["request_number"]],
            request = list(
              mean = input[["request_mean"]],
              shape = input[["request_shape"]]
            )
          ),

          system = list(
            cpu = input[["cpu"]]
          ),

          runtime = list(
            min_processes  = input[["processes"]][1],
            max_processes = input[["processes"]][2],
            max_connections_per_process = input[["max_connections_per_process"]],
            load_factor = input[["load_factor"]]
          ),

          app = list(
            startup_time = input[["app_startup_time"]],
            response_time = input[["app_response_time"]]
          )
        )
      )
    })

    env <- shimmer(config = params())


    # First row of value boxes

    cpu_ratio <- env %>%
      fast_server_usage_summary("cpu", summarize = TRUE) %>% .$mean

    output$cpu_box <- renderValueBox({
      adaptiveValueBox(cpu_ratio, "CPU usage", as_percent = TRUE,
                       icon = icon("microchip"),
                       thresholds = c(0.7, 0.85),
                       reverse = FALSE
      )
    })

    rejections <- last_resource_value(env, "rejections")
    connections <- last_resource_value(env, "total_connections")
    reject_ratio <- rejections / (rejections + connections)

    output$rejection_box <- renderValueBox({
      adaptiveValueBox(reject_ratio, "Rejection rate", as_percent = TRUE,
                       icon = icon("ban"),
                       thresholds = c(0, 0.01)
      )
    })

    duration_ratio <- shimmer:::compute_duration_ratio(
      env,
      params()$app$response_time
    )

    output$duration_box <- renderValueBox({
      adaptiveValueBox(duration_ratio, "Responsiveness", as_percent = TRUE,
                       icon = icon("hourglass-end"),
                       thresholds = c(0.9, 0.95), reverse = TRUE
      )
    })

    # Second row of plots


    output$cpu_usage_plot <- renderPlot({
      plot_shimmer_cpu_usage(env)
    })
    output$rejection_usage_plot <- renderPlot({
      plot_shimmer_rejection_usage(env)
    })
    output$cpu_histogram <- renderPlot({
      plot_shimmer_response_histogram(env)
    })

    # Third row of plots

    output$connection_usage_plot <- renderPlot({
      plot_shimmer_connection_usage(env)
    })
    output$process_usage_plot <- renderPlot({
      plot_shimmer_process_usage(env)
    })

  })


})
