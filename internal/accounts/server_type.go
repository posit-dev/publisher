package accounts

// Copyright (C) 2023 by Posit Software, PBC.

type ServerType string

const (
	ServerTypeConnect     ServerType = "connect"
	ServerTypeShinyappsIO ServerType = "shinyapps"
	ServerTypeCloud       ServerType = "cloud"
)

var accountTypeDescriptions = map[ServerType]string{
	ServerTypeConnect:     "Posit Connect",
	ServerTypeShinyappsIO: "shinyapps.io",
	ServerTypeCloud:       "Posit Cloud",
}

func (t ServerType) Description() string {
	if desc, ok := accountTypeDescriptions[t]; ok {
		return desc
	}
	return string(t)
}

// serverTypeFromURL infers a server type from the server URL.
// For Posit-deployed servers (shinyapps.io, posit.cloud)
// it returns the corresponding type. Otherwise,
// it assumes a Connect server.
func serverTypeFromURL(url string) ServerType {
	switch url {
	case "https://api.posit.cloud":
		return ServerTypeCloud
	case "https://api.rstudio.cloud":
		return ServerTypeCloud
	case "https://api.shinyapps.io":
		return ServerTypeShinyappsIO
	default:
		return ServerTypeConnect
	}
}
