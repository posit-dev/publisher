package project

// Copyright (C) 2023 by Posit Software, PBC.

// Version is set by the linked
var Version string

func UserAgent() string {
	if Version != "" {
		return "connect-client/" + Version
	}
	return "connect-client"
}
