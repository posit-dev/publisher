package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"
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
func DirFromPath(path Path) (Path, error) {
	isDir, err := path.IsDir()
	if err != nil {
		return Path{}, err
	}
	if isDir {
		return path, nil
	} else {
		return path.Dir(), nil
	}
}

var pythonBinPaths = []string{
	"bin/python",
	"bin/python3",
	"Scripts/python.exe",
	"Scripts/python3.exe",
}

func IsPythonEnvironmentDir(path Path) bool {
	for _, binary := range pythonBinPaths {
		exists, err := path.Join(binary).Exists()
		if err == nil && exists {
			return true
		}
	}
	return false
}
