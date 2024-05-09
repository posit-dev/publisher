package project

// Copyright (C) 2023 by Posit Software, PBC.

// Version is set by the linker
var Version string
var Mode string

func UserAgent() string {
	if Version != "" {
		return "posit-publisher/" + Version
	}
	return "posit-publisher"
}

func DevelopmentBuild() bool {
	return Mode == "dev"
}
