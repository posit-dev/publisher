# Defines the dashboard tab

ui_tab_simulation <- tabItem(
  tabName = "simulation",
  fluidRow(
    box(
      width = 3,
      with(
        defaults$ui$simulation$processes,
        sliderInput("processes",
                    "min and max processes:",
                    min = min,
                    max = max,
                    value = value,
                    step = step
        )
      )
    ),
    box(
      width = 3,
      with(
        defaults$ui$simulation$max_connections_per_process,
        sliderInput("max_connections_per_process",
                    "max conns per process:",
                    min = min,
                    max = max,
                    value = value,
                    step = step
        ),
        helpText("foo")
      )
    ),
    box(
      width = 3,
      with(
        defaults$ui$simulation$load_factor,
        sliderInput("load_factor",
                    "load factor:",
                    min = min,
                    max = max,
                    value = value,
                    step = step
        )
      )
    ),
    box(
      width = 3,
      with(
        defaults$ui$simulation$cpu,
        sliderInput("cpu",
                    "cpu count:",
                    min = min,
                    max = max,
                    value = value,
                    step = step
        )
      )
    ),
    # go button !!!
    box(
      width = 12,
      actionButton("go_button", " Go!", icon = icon("dashboard"))
    ),

    # first row of output with value boxes

    conditionalPanel(
      "input.go_button >= 1",
      fluidRow(
        valueBoxOutput("cpu_box"),
        valueBoxOutput("rejection_box"),
        valueBoxOutput("duration_box")
      )
    ),

    # second row of output with key plots

    conditionalPanel(
      "input.go_button >= 1",
      fluidRow(
        class = "row300",
        box(
          width = 4,
          plotOutput("cpu_usage_plot", height = "200px") %>% withSpinner()
        ),
        box(
          width = 4,
          plotOutput("rejection_usage_plot", height = "200px") %>% withSpinner()
        ),
        box(
          width = 4,
          plotOutput("cpu_histogram", height = "200px") %>% withSpinner()
        )
      ),

      # third  row of output with detail plots

      fluidRow(
        class = "row300",
        box(
          width = 4,
          plotOutput("connection_usage_plot") %>% withSpinner()
        ),
        box(
          width = 8,
          plotOutput("process_usage_plot") %>% withSpinner()
        )
      )
    )

  )
)
