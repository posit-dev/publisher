package web

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"embed"
)

//go:embed dist/spa
var Dist embed.FS
