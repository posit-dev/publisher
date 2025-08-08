package accounts

// Copyright (C) 2023 by Posit Software, PBC.

type AccountSource string

const (
	AccountSourceRsconnectPython AccountSource = "rsconnect-python"
	AccountSourceRsconnect       AccountSource = "rsconnect"
	AccountSourceKeychain        AccountSource = "keychain"
)

var sourceDescriptions = map[AccountSource]string{
	AccountSourceRsconnectPython: "rsconnect-python",
	AccountSourceRsconnect:       "RStudio IDE/rsconnect",
}

func (source AccountSource) Description() string {
	if desc, ok := sourceDescriptions[source]; ok {
		return desc
	}
	return string(source)
}
