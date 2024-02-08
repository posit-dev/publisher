

ui_tab_users <- tabItem(
  tabName = "users",
  fluidRow(
    box(
      title = "Arrival of users",
      width = 6,
      with(
        defaults$ui$users$user_mean,
        sliderInput("user_mean",
                    "Time between user arrival:",
                    min = min,
                    max = max,
                    value = value,
                    step = step
        )
      ),
      helpText("Indicates how frequently new users enter the system.")
    ),
    box(
      title = "Requests made by each user",
      width = 6,
      with(
        defaults$ui$users$request_mean,
        sliderInput("request_mean",
                    "Time between requests:",
                    min = min,
                    max = max,
                    value = value,
                    step = step
        )
      ),
      helpText("Elapsed time between requests made by the user"),
      with(
        defaults$ui$users$request_number,
        sliderInput("request_number",
                    "number of requests:",
                    min = min,
                    max = max,
                    value = value,
                    step = step
        )
      ),
      helpText("The number of requests (interactions or clicks) made by every user before becoming inactive")

    ),
    box(
      width = 12,
      actionButton('switch_to_simulation', ' Step 3: Simulation', icon = icon("dashboard"))

    )
  ),
  fluidRow(
    box(
    title = "Advanced user settings",
      width = 6,
      with(
        defaults$ui$users$user_shape,
        sliderInput("user_shape",
                    "shape:",
                    min = min,
                    max = max,
                    value = value,
                    step = step
        )
      ),
      helpText("Use a low value for an exponential distribution, and high value for quasi-normal distribution.  Technically this is the shape parameter of a gamma distribution."),

      plotOutput("user_plot")
    ),
    box(
      title = "Advanced request settings",
      width = 6,
      with(
        defaults$ui$users$request_shape,
        sliderInput("request_shape",
                    "shape:",
                    min = min,
                    max = max,
                    value = value,
                    step = step
        )
      ),
      helpText("Use a low value for an exponential distribution, and high value for quasi-normal distribution.  Technically this is the shape parameter of a gamma distribution."),


      plotOutput("request_plot")
    )
  )

)
