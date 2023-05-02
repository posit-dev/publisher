package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/afero"
)

type Size int64

func (n Size) String() string {
	if n < 1e3 {
		return fmt.Sprintf("%d", n)
	} else if n < 1e6 {
		return fmt.Sprintf("%.1f KB", float64(n)/1e3)
	} else if n < 1e9 {
		return fmt.Sprintf("%.1f MB", float64(n)/1e6)
	} else if n < 1e12 {
		return fmt.Sprintf("%.1f GB", float64(n)/1e9)
	} else {
		return fmt.Sprintf("%.1f TB", float64(n)/1e12)
	}
}

func (n Size) ToInt64() int64 {
	return int64(n)
}

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
