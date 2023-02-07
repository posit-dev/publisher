package accounts

// Copyright (C) 2023 by Posit Software, PBC.

type ServerType string

const (
	ServerTypeConnect     ServerType = "connect"
	ServerTypeShinyappsIO            = "shinyapps"
	ServerTypeCloud                  = "cloud"
)

func (t ServerType) String() string {
	switch t {
	case ServerTypeConnect:
		return "Posit Connect"
	case ServerTypeShinyappsIO:
		return "shinyapps.io"
	case ServerTypeCloud:
		return "Posit Cloud"
	default:
		return string(t)
	}
}

// Infer a server type from the server URL.
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
