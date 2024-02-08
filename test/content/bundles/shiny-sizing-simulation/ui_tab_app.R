ui_tab_app <- tabItem(
  tabName = "app",
  fluidRow(
    box(
      title = "App startup and response time",
      width = 6,
      with(
        defaults$ui$app$app_startup_time,
        sliderInput("app_startup_time",
                    "App startup time (seconds):",
                    min = min,
                    max = max,
                    value = value
        )
      ),
      helpText("App startup time is the time (in seconds) that it takes the app to start, i.e. the amount of time the user waits for the first response")
    ),
    box(
      title = "App response time",
      width = 6,
      with(
        defaults$ui$app$app_response_time,
        sliderInput("app_response_time",
                    "App response time (seconds):",
                    min = min,
                    max = max,
                    value = value
        )
      ),
      helpText("App response time is the amount of time the user waits for a typical response")
    ),
    box(
      width = 12,
      actionButton('switch_to_users', ' Step 2: Users assumptions', icon = icon("users"))
    )

  )
)


