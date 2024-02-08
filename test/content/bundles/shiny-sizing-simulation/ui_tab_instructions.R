
intro_text <- p(
  "The ", code("shimmer"), "package contains a discrete event simulation that explores how ", code("shiny"), " processes behave at scale, typically orchestrated by ", strong("RStudio Connect"), " or ", strong("Shiny Server Pro."),
  br(), br(),
  "The underlying infrastructure of the simulation is provided by the ", code("simmer") , " package (for discrete event simulations). In other words, ", code("shimmer"), " simulates how Shiny apps scale by using the ", code("simmer"), " simulation framework."
)

using_text <- p(
"To use this app, complete your measurement or assumptions for ", em("Step 1: App assumptions"), " and ", em("Step 2: Users assumptions"), ",then run the simulation using the ", em("Step 3: Simulate"), " tab."
)

ui_tab_instructions <- tabItem(
  tabName = "instructions",
  fluidRow(
    box(
      title = "Instructions",
      width = 18,
      helpText(intro_text),
      helpText(""),
      helpText(using_text)
    ),
    box(
      actionButton('switch_to_app', ' Step 1: App assumptions', icon = icon("laptop")),
      width = 18
    )

  )
)
