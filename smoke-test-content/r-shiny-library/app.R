# Minimal Shiny app for smoke-testing packages_from_library = true
# Depends on: shiny (from CRAN via renv library)

library(shiny)

ui <- fluidPage(
  titlePanel("Library Mapper Smoke Test"),
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
