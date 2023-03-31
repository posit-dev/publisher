package accounts

// Copyright (C) 2023 by Posit Software, PBC.

type AccountSource string

const (
	AccountSourceRsconnectPython AccountSource = "rsconnect-python"
	AccountSourceRsconnect       AccountSource = "rsconnect"
	AccountSourceEnvironment     AccountSource = "environment"
)

var sourceDescriptions = map[AccountSource]string{
	AccountSourceRsconnectPython: "rsconnect-python",
	AccountSourceRsconnect:       "RStudio IDE/rsconnect",
	AccountSourceEnvironment:     "CONNECT_SERVER environment variable",
}

func (source AccountSource) Description() string {
	if desc, ok := sourceDescriptions[source]; ok {
		return desc
	}
	return string(source)
}
