package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/schema"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
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
	configs, err := detector.InferType(base, util.RelativePath{})
	s.Nil(err)
	s.Len(configs, 1)

	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeJupyterNotebook,
		Entrypoint: filename,
		Validate:   &validate,
		Files:      []string{},
		Python:     &config.Python{},
	}, configs[0])
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
	configs, err := detector.InferType(base, util.RelativePath{})
	s.Nil(err)
	s.Len(configs, 1)

	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeJupyterVoila,
		Entrypoint: filename,
		Validate:   &validate,
		Files:      []string{},
		Python:     &config.Python{},
	}, configs[0])
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
	configs, err := detector.InferType(base, util.RelativePath{})
	s.Nil(err)
	s.Nil(configs)
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
	t, err := detector.InferType(base, util.RelativePath{})
	s.NotNil(err)
	s.Nil(t)
}

func (s *NotebookDetectorSuite) TestInferTypeEmptyNotebook() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "my_notebook.ipynb"
	path := base.Join(filename)
	// oops, content is not in notebook format
	err = path.WriteFile([]byte{}, 0600)
	s.Nil(err)

	detector := NewNotebookDetector()
	t, err := detector.InferType(base, util.RelativePath{})
	s.Nil(err)
	s.Nil(t)
}

func (s *NotebookDetectorSuite) TestInferTypeWithEntrypoint() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "my_notebook.ipynb"
	err = base.Join(filename).WriteFile(notebookWithCell("import sys\nprint(sys.executable)\n"), 0600)
	s.Nil(err)

	otherFilename := "not_the_entrypoint.ipynb"
	err = base.Join(otherFilename).WriteFile(notebookWithCell("import sys\nprint(sys.executable)\n"), 0600)
	s.Nil(err)

	detector := NewNotebookDetector()
	entrypoint := util.NewRelativePath(filename, base.Fs())
	configs, err := detector.InferType(base, entrypoint)
	s.Nil(err)
	s.Len(configs, 1)

	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeJupyterNotebook,
		Entrypoint: filename,
		Validate:   &validate,
		Files:      []string{},
		Python:     &config.Python{},
	}, configs[0])
}
