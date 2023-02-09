package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"io/fs"
	"os"
)

func Exists(path string) bool {
	_, err := os.Stat(path)
	return !errors.Is(err, fs.ErrNotExist)
}
