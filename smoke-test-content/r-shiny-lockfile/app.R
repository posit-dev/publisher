# Minimal Shiny app for smoke-testing standard lockfile-only path
# Depends on: shiny (from CRAN via renv.lock)

library(shiny)

ui <- fluidPage(
  titlePanel("Lockfile Mapper Smoke Test"),
  mainPanel(
    h3("If you can see this, the deployment succeeded!"),
    verbatimTextOutput("pkgInfo")
  )
)

server <- function(input, output) {
  output$pkgInfo <- renderPrint({
    cat("shiny version:", as.character(packageVersion("shiny")), "\n")
    cat("R version:", R.version.string, "\n")
  })
}

shinyApp(ui = ui, server = server)
