package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/schema"
	"github.com/rstudio/connect-client/internal/util"
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

func notebookWithCell(cellContent string) []byte {
	content, _ := json.Marshal(strings.Split(cellContent, "\n"))
	fileContent := fmt.Sprintf(`
		{
			"cells": [
			 {
			  "cell_type": "code",
			  "execution_count": null,
			  "metadata": {},
			  "outputs": [],
			  "source": %s
			}
			],
			"metadata": {
			 "kernelspec": {
			  "display_name": "Python 3",
			  "language": "python",
			  "name": "python3"
			 },
			 "language_info": {
			  "codemirror_mode": {
			   "name": "ipython",
			   "version": 3
			  },
			  "file_extension": ".py",
			  "mimetype": "text/x-python",
			  "name": "python",
			  "nbconvert_exporter": "python",
			  "pygments_lexer": "ipython3",
			  "version": "3.7.0"
			 }
			},
			"nbformat": 4,
			"nbformat_minor": 2
		   }
	`, string(content))
	return []byte(fileContent)
}

func (s *NotebookDetectorSuite) TestInferTypePlainNotebook() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "my_notebook.ipynb"
	err = base.Join(filename).WriteFile(notebookWithCell("import sys\nprint(sys.executable)\n"), 0600)
	s.Nil(err)

	detector := NewNotebookDetector()
	t, err := detector.InferType(base)
	s.Nil(err)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeJupyterNotebook,
		Entrypoint: filename,
		Validate:   true,
		Files:      []string{"*"},
		Python:     &config.Python{},
	}, t)
}

func (s *NotebookDetectorSuite) TestInferTypeVoilaNotebook() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "my_notebook.ipynb"
	path := base.Join(filename)
	err = path.WriteFile(notebookWithCell("import ipywidgets\nprint('hello')\n"), 0600)
	s.Nil(err)

	detector := NewNotebookDetector()
	t, err := detector.InferType(base)
	s.Nil(err)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeJupyterVoila,
		Entrypoint: filename,
		Validate:   true,
		Files:      []string{"*"},
		Python:     &config.Python{},
	}, t)
}

func (s *NotebookDetectorSuite) TestInferTypeNonNotebook() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "app.py"
	path := base.Join(filename)
	err = path.WriteFile(notebookWithCell("import ipywidgets\nprint('hello')\n"), 0600)
	s.Nil(err)

	detector := NewNotebookDetector()
	t, err := detector.InferType(base)
	s.Nil(err)
	s.Nil(t)
}

func (s *NotebookDetectorSuite) TestInferTypeFsErr() {
	base := util.NewAbsolutePath("/nonexistent", afero.NewMemMapFs())
	detector := NewNotebookDetector()
	t, err := detector.InferType(base)
	s.NotNil(err)
	s.ErrorIs(err, os.ErrNotExist)
	s.Nil(t)
}

func (s *NotebookDetectorSuite) TestInferTypeBadNotebook() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "my_notebook.ipynb"
	path := base.Join(filename)
	// oops, content is not in notebook format
	err = path.WriteFile([]byte("import ipywidgets\nprint('hello')\n"), 0600)
	s.Nil(err)

	detector := NewNotebookDetector()
	t, err := detector.InferType(base)
	s.NotNil(err)
	s.Nil(t)
}
