package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"strings"
)

// URLJoin joins two url parts with a slash.
func URLJoin(a, b string) string {
	return strings.TrimRight(a, "/") + "/" + strings.TrimLeft(b, "/")
}
