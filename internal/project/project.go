package project

// Copyright (C) 2023 by Posit Software, PBC.

// Version is set by the linker
var Version string

func UserAgent() string {
	if Version != "" {
		return "github.com/rstudio/connect-client/internal/" + Version
	}
	return "connect-client"
}
