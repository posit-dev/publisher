package servers

// Copyright (C) 2023 by Posit Software, PBC.

type ServerSource string

const (
	ServerSourceRSCP        ServerSource = "rsconnect-python"
	ServerSourceRsconnect                = "rsconnect"
	ServerSourceEnvironment              = "environment"
)

func (source ServerSource) String() string {
	switch source {
	case ServerSourceRSCP:
		return "rsconnect-python"
	case ServerSourceRsconnect:
		return "RStudio IDE/rsconnect"
	case ServerSourceEnvironment:
		return "CONNECT_SERVER environment variable"
	default:
		return string(source)
	}
}
