package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"path/filepath"
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type NotebookDetectorSuite struct {
	utiltest.Suite
}

func TestNotebookDetectorSuite(t *testing.T) {
	suite.Run(t, new(NotebookDetectorSuite))
}

func (s *NotebookDetectorSuite) TestGetNotebookFileInputs() {
	path := filepath.Join("testdata", "good_notebook.ipynb.txt")
	inputs, err := getNotebookFileInputs(afero.NewOsFs(), path)
	s.Nil(err)
	s.Equal("import sys\nprint(sys.executable)\nprint('Summing')\n123 + 456\n", inputs)
}
