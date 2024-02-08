library(shiny)
library(datasets)
# library(RODBC)
# library(RJDBC)
# library(data.table)
# library(assertthat)
# library(stringr)
# library(ggplot2)
# #library(Colibri)
# library(googleVis)

# We tweak the "am" field to have nicer factor labels. Since this doesn't
# rely on any user inputs we can do this once at startup and then use the
# value throughout the lifetime of the application
mpgData <- mtcars
mpgData$am <- factor(mpgData$am, labels = c("Automatic", "Manual"))

#BUG This call makes RStudio become unresponsive. Added it just for this testing.
#ch.dwprod <- odbcDriverConnect("SERVER=VIP-PSQLDB04;DRIVER=shiny-mssql;DATABASE=dwprod;UID=GCW_readonly;PWD=G3n0m1cs") 
#a <- odbcDriverConnect()

# Define server logic required to plot various variables against mpg
shinyServer(function(input, output) {
  #url = "http://something-weird"
  #url= "http://maps.googleapis.com/maps/api/staticmap?center=46.625,8.03&zoom=13&size=640x640&scale=2&maptype=satellite&language=en-EN&sensor=false"
  #a <- download.file(url, destfile="./tmp", quiet=FALSE, mode="wb")
  # Compute the forumla text in a reactive expression since it is 
  # shared by the output$caption and output$mpgPlot functions
  formulaText <- reactive({
    paste("mpg ~", input$variable)
  })
   
  # Return the formula text for printing as a caption
  output$caption <- renderText({
    formulaText()
  })
  
  # Generate a plot of the requested variable against mpg and only 
  # include outliers if requested
  output$mpgPlot <- renderPlot({
    boxplot(as.formula(formulaText()), 
            data = mpgData, 
            outline = input$outliers)
  })
})
