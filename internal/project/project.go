package project

// Copyright (C) 2023 by Posit Software, PBC.

// Version is set by the linker
var Version string
var Mode string

func UserAgent() string {
	if Version != "" {
		return "publishing-client/" + Version
	}
	return "publishing-client"
}

func DevelopmentBuild() bool {
	return Mode == "development"
}
