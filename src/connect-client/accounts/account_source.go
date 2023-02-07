package accounts

// Copyright (C) 2023 by Posit Software, PBC.

type AccountSource string

const (
	AccountSourceRSCP        AccountSource = "rsconnect-python"
	AccountSourceRsconnect                 = "rsconnect"
	AccountSourceEnvironment               = "environment"
)

func (source AccountSource) String() string {
	switch source {
	case AccountSourceRSCP:
		return "rsconnect-python"
	case AccountSourceRsconnect:
		return "RStudio IDE/rsconnect"
	case AccountSourceEnvironment:
		return "CONNECT_SERVER environment variable"
	default:
		return string(source)
	}
}
