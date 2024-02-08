#* @apiTitle Stock Information API
#* @apiVersion 1.0.0
#* @apiDescription This Plumber API surfaces the ability to programmatically request price history or a number representing the relative volatility of a stock ticker

library(dplyr)

valid_tickers <- c(
  Apple = "AAPL",
  Amazon = "AMZN",
  Facebook = "FB",
  Google = "GOOG",
  Intel = "INTC",
  Microsoft = "MSFT"
)

all_data <- readRDS("stock_data.rds") %>%
  as_tibble()

get_price_data <- function(data, ticker = "AMZN", from = "2010-01-01") {
  data %>%
    filter(
      ticker == {{ ticker }},
      date >= as.Date(from, format="%Y-%m-%d")
    ) %>%
    collect()
}

#* Protect against an invalid ticker
#* @filter checkTicker
function(req, res) {
  if (!is.null(req$args$ticker) && !req$args$ticker %in% valid_tickers) {
    res$status <- 400
    return(
      list(
        error = paste(
          "Invalid ticker. Please use one of",
          paste(
            "'", valid_tickers, "'",
            sep = "", collapse = ", "
          )
        )
      )
    )
  } else {
    plumber::forward()
  }
}

#* @get /price
#* @param ticker:character ticker symbol (MSFT; AMZN; AAPL; FB; GOOG)
#* @response 200 Returns price for ticker
#* @response 400 Bad ticker
#* @response 500 Bad ticker
#* @response default Returns price for ticker
price <- function(ticker = "AMZN") {
  get_price_data(all_data, ticker, "2010-01-01")
}

#* @get /volatility
#* @param ticker:character ticker symbol (MSFT; AMZN; AAPL; FB; GOOG)
#* @response 200 Returns volatility for ticker
#* @response 400 Bad ticker
#* @response 500 Bad ticker
#* @response default Returns volatility for ticker
volatility <- function(ticker = "AMZN") {
  price <- get_price_data(all_data, ticker, "2010-01-01") %>%
    select(date, adjusted) %>%
    mutate(returns = (log(adjusted) - log(lag(adjusted)))) %>%
    na.omit() %>%
    summarize(volatility = var(returns))

  list(ticker = ticker, volatility = price$volatility)
}
