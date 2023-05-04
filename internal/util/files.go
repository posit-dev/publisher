package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"
	"path/filepath"

	"github.com/spf13/afero"
)

func Chdir(dir string) (string, error) {
	oldWd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	err = os.Chdir(dir)
	if err != nil {
		return "", err
	}
	return oldWd, nil
}

// DirFromPath returns the directory associated with the specified path.
// If the path is a directory, it is returned.
// Otherwise, the parent dir of the path is returned.
func DirFromPath(fs afero.Fs, path string) (string, error) {
	isDir, err := afero.IsDir(fs, path)
	if err != nil {
		return "", err
	}
	if isDir {
		return path, nil
	} else {
		return filepath.Dir(path), nil
	}
}
