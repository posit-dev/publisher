package accounts

// Copyright (C) 2023 by Posit Software, PBC.

type AccountType string

const (
	AccountTypeConnect     AccountType = "connect"
	AccountTypeShinyappsIO AccountType = "shinyapps"
	AccountTypeCloud       AccountType = "cloud"
)

var accountTypeDescriptions = map[AccountType]string{
	AccountTypeConnect:     "Posit Connect",
	AccountTypeShinyappsIO: "shinyapps.io",
	AccountTypeCloud:       "Posit Cloud",
}

func (t AccountType) Description() string {
	if desc, ok := accountTypeDescriptions[t]; ok {
		return desc
	}
	return string(t)
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
