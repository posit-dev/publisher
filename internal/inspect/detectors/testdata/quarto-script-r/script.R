#' ---
#' title: "Penguin data transformations"
#' subtitle: "Exported as JSON and CSV"
#' format: email
#' email-attachments:
#'   - "adelie-m.csv"
#'   - "gentoo-f.csv"
#' ---

#' ## Setup
library(palmerpenguins)
library(jsonlite)

#' ## Filtering
gentoo_f <- subset(penguins, species == "Gentoo" & sex == "female")
adelie_m <- subset(penguins, species == "Adelie" & sex == "male")

#' ## Statistics (Gentoo)
summary(gentoo_f)

#' ## Statistics (Adelie)
summary(adelie_m)

#' ## Export
write(jsonlite::toJSON(gentoo_f), "gentoo-f.json")
write.csv(gentoo_f, "gentoo-f.csv")
write(jsonlite::toJSON(adelie_m), "adelie-m.json")
write.csv(adelie_m, "adelie-m.csv")

#' # Exported data
#'
#' * [gentoo-f.json](gentoo-f.json)
#' * [gentoo-f.csv](gentoo-f.csv)
#' * [adelie-m.json](adelie-m.json)
#' * [adelie-m.csv](adelie-m.csv)
#'
#' ::: {.email}
#' ::: {.subject}
#' Penguin data files
#' :::

#| echo: false
#| output: asis
cat("Identified", nrow(gentoo_f), "female Gentoo penguins.\n")
cat("Identified", nrow(adelie_m), "male Adelie penguins.\n")
cat("\n")
cat("CSV files are attached.\n")

#' :::
