package project

// Copyright (C) 2023 by Posit Software, PBC.

// Version is set by the linker
var Version string
var Mode string

func DevelopmentBuild() bool {
	return Mode == "dev"
}
