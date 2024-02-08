function(input, output) {
  output$waiting <- renderPlot({
    x <- faithful$waiting
    bins <- seq(min(x), max(x), length.out = input$bins + 1)
    hist(x, breaks = bins, col = 'darkgray', border = 'white',
         xlab = "Waiting time (minutes)", main = "Geyser Eruption Waiting Time")
  })
}
