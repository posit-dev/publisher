library(plumber)
library(plumbertableau)
library(outForest)
library(dplyr)

#* @apiTitle Outlier Detection for Tableau
#* @apiDescription Detect outliers in real-time on Tableau data using a Random Forest

#* Calculate outliers on input data
#* @tableauArg sales:numeric Numeric values representing sales for a given transaction
#* @tableauArg profit:numeric Numeric values representing profit for a given transaction
#* @tableauReturn logical A vector indicating the outlier status of each original observation
#* @post /detect-outliers
function(sales, profit) {
  dat <- tibble(sales, profit)
  out <- outForest(dat)
  outlier_rows <- outliers(out) %>%
    select(row) %>%
    distinct()

  dat %>%
    mutate(row = 1:n(),
           outlier = row %in% outlier_rows$row) %>%
    pull(outlier)
}

#* @plumber
tableau_extension
