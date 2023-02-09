package accounts

// Copyright (C) 2023 by Posit Software, PBC.

type AccountSource string

const (
	AccountSourceRsconnectPython AccountSource = "rsconnect-python"
	AccountSourceRsconnect                     = "rsconnect"
	AccountSourceEnvironment                   = "environment"
)

func (source AccountSource) Description() string {
	switch source {
	case AccountSourceRsconnectPython:
		return "rsconnect-python"
	case AccountSourceRsconnect:
		return "RStudio IDE/rsconnect"
	case AccountSourceEnvironment:
		return "CONNECT_SERVER environment variable"
	default:
		return string(source)
	}
}
