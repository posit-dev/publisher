package servers

// Copyright (C) 2023 by Posit Software, PBC.

type ServerSource string

const (
	ServerSourceRSCP        ServerSource = "rsconnect-python"
	ServerSourceIDE                      = "rstudio-ide"
	ServerSourceEnvironment              = "environment"
)

func (source ServerSource) String() string {
	switch source {
	case ServerSourceRSCP:
		return "rsconnect-python"
	case ServerSourceIDE:
		return "RStudio IDE"
	case ServerSourceEnvironment:
		return "CONNECT_SERVER environment variable"
	default:
		return string(source)
	}
}
