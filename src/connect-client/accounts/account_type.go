package accounts

// Copyright (C) 2023 by Posit Software, PBC.

type AccountType string

const (
	AccountTypeConnect     AccountType = "connect"
	AccountTypeShinyappsIO             = "shinyapps"
	AccountTypeCloud                   = "cloud"
)

func (t AccountType) String() string {
	switch t {
	case AccountTypeConnect:
		return "Posit Connect"
	case AccountTypeShinyappsIO:
		return "shinyapps.io"
	case AccountTypeCloud:
		return "Posit Cloud"
	default:
		return string(t)
	}
}

// accountTypeFromURL infers an account type from the server URL.
// For Posit-deployed servers (shinyapps.io, posit.cloud)
// it returns the corresponding type. Otherwise,
// it assumes a Connect server.
func accountTypeFromURL(url string) AccountType {
	switch url {
	case "https://api.posit.cloud":
		return AccountTypeCloud
	case "https://api.rstudio.cloud":
		return AccountTypeCloud
	case "https://api.shinyapps.io":
		return AccountTypeShinyappsIO
	default:
		return AccountTypeConnect
	}
}
