package gitignore

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"regexp"

	"github.com/rstudio/connect-client/internal/util"
)

type MatchSource string

const MatchSourceFile MatchSource = "file"
const MatchSourceBuiltIn MatchSource = "built-in"

type Pattern struct {
	Source   MatchSource       `json:"source"`    // type of match, e.g. file or a caller-provided value
	Pattern  string            `json:"pattern"`   // exclusion pattern as read from the file
	Inverted bool              `json:"-"`         // true if this pattern un-ignores a file
	FilePath util.AbsolutePath `json:"file_path"` // path to the file where this was defined, empty if not from a file
	Line     int               `json:"line"`      // line in the file where this was defined, 0 if not from a file
	regex    *regexp.Regexp
}
