package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"
)

type ExistsFunc func(p Path) (bool, error)

var KnownSiteYmlConfigFiles = []string{"_site.yml", "_site.yaml", "_bookdown.yml", "_bookdown.yaml"}

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

var pythonBinPaths = []string{
	"bin/python",
	"bin/python3",
	"Scripts/python.exe",
	"Scripts/python3.exe",
}

func IsPythonEnvironmentDir(path AbsolutePath) bool {
	for _, binary := range pythonBinPaths {
		exists, err := path.Join(binary).Exists()
		if err == nil && exists {
			return true
		}
	}
	return false
}

func IsRenvLibraryDir(path AbsolutePath) bool {
	return path.Dir().Base() == "renv" &&
		(path.Base() == "library" || path.Base() == "sandbox" || path.Base() == "staging")
}

