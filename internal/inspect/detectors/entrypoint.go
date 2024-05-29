package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"io"
	"regexp"

	"github.com/posit-dev/publisher/internal/util"
)

type defaultInferenceHelper struct{}

func (h defaultInferenceHelper) FileHasPythonImports(path util.AbsolutePath, packages []string) (bool, error) {
	f, err := path.Open()
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
