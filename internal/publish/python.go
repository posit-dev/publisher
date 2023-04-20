package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"io"
	"regexp"

	"github.com/spf13/afero"
)

func (h defaultInferenceHelper) FileHasPythonImports(fs afero.Fs, path string, packages []string) (bool, error) {
	f, err := fs.Open(path)
	if err != nil {
		return false, err
	}
	defer f.Close()
	return h.HasPythonImports(f, packages)
}

func (h defaultInferenceHelper) HasPythonImports(r io.Reader, packages []string) (bool, error) {
	contents, err := io.ReadAll(r)
	if err != nil {
		return false, err
	}

	for _, pkg := range packages {
		packageRe := fmt.Sprintf("import %s|from %s.* import", pkg, pkg)
		matched, err := regexp.Match(packageRe, contents)
		if err != nil {
			return false, err
		}
		if matched {
			return true, nil
		}
	}
	return false, nil
}
