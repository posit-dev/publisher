package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"path/filepath"
	"strings"

	"github.com/rstudio/connect-client/internal/apitypes"
	"github.com/spf13/afero"
)

type FlaskDetector struct{}

var flaskImportNames = []string{
	"flask", // also matches flask_api, flask_openapi3, etc.
	"flasgger",
}

func (d *FlaskDetector) InferType(fs afero.Fs, path string) (*ContentType, error) {
	t := &ContentType{}
	if strings.HasSuffix(path, ".py") {
		t.entrypoint = apitypes.NewOptional(filepath.Base(path))
	} else {
		isDir, err := afero.IsDir(fs, path)
		if err != nil {
			return nil, err
		}
		if !isDir {
			// We can only deploy directories or python files
			return nil, nil
		}
		t.entrypoint, err = inferEntrypoint(fs, path, "*.py", "app.py")
	}
	if filename, ok := t.entrypoint.Get(); ok {
		isFlask, err := fileHasPythonImports(fs, filename, flaskImportNames)
		if err != nil {
			return nil, err
		}
		if isFlask {
			return t, nil
		}
		// else we didn't find a Flask import
	}
	return nil, nil
}
