package matcher

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"regexp"

	"github.com/posit-dev/publisher/internal/util"
)

type MatchSource string

const MatchSourceFile MatchSource = "file"
const MatchSourceBuiltIn MatchSource = "built-in"

type Pattern struct {
	Source   MatchSource       `json:"source"`   // type of match, e.g. file or a caller-provided value
	Pattern  string            `json:"pattern"`  // exclusion pattern as read from the file
	Exclude  bool              `json:"exclude"`  // true if this pattern un-matches a file
	FileName string            `json:"fileName"` // name of the file where this was defined, empty if not from a file
	FilePath util.AbsolutePath `json:"filePath"` // path to the file where this was defined, empty if not from a file
	regex    *regexp.Regexp
}
