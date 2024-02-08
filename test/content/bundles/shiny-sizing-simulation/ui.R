#
# This is the user-interface definition of a Shiny web application. You can
# run the application by clicking 'Run App' above.
#
# Find out more about building applications with Shiny here:
#
#    http://shiny.rstudio.com/
#

# max_processes: 3
# min_processes: 0
# max_connections_per_process: 20
# load_factor: 0.5
# idle_timeout_per_process: 5.0
# initial_timeout: 300
# connection_timeout: 3600
# read_timeout: 3600


suppressPackageStartupMessages({
  library(shiny)
  library(shinydashboard)
  library(magrittr)
  library(shinycssloaders)
  library(config)
})



sidebar <-   dashboardSidebar(
  sidebarMenu(
    id = "sidebar_tabs",
    menuItem("Instructions", tabName = "instructions", icon = icon("info")),
    menuItem("Step 1: App assumptions", tabName = "app", icon = icon("laptop")),
    menuItem("Step 2: Users assumptions", tabName = "users", icon = icon("users")),
    menuItem("Step 3: Simulate", tabName = "simulation", icon = icon("dashboard"))
  )
)


source("ui_tab_instructions.R", local = TRUE)
source("ui_tab_app.R", local = TRUE)
source("ui_tab_users.R", local = TRUE)
source("ui_tab_simulation.R", local = TRUE)


body <- dashboardBody(
  tags$head(
    tags$link(rel = "stylesheet", type = "text/css", href = "custom.css")
  ),
  tabItems(
    ui_tab_instructions,
    ui_tab_app,
    ui_tab_users,
    ui_tab_simulation
  )
)


dashboardPage(
  dashboardHeader(title = "Shimmer: Shiny sizing simulation"),
  sidebar,
  body
)



