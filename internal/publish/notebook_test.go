package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/rstudio/connect-client/internal/publish/apptypes"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
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

func (s *NotebookDetectorSuite) TestGetNotebookFileInputs() {
	path := filepath.Join("testdata", "good_notebook.ipynb.txt")
	inputs, err := getNotebookFileInputs(afero.NewOsFs(), path)
	s.Nil(err)
	s.Equal("import sys\nprint(sys.executable)\nprint('Summing')\n123 + 456\n", inputs)
}

func (s *NotebookDetectorSuite) TestGetNotebookFileInputsErr() {
	path := filepath.Join("testdata", "good_notebook.ipynb.txt")
	fs := utiltest.NewMockFs()
	testError := errors.New("test error from Open")
	fs.On("Open", mock.Anything).Return(nil, testError)
	inputs, err := getNotebookFileInputs(fs, path)
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Equal("", inputs)
}

func (s *NotebookDetectorSuite) TestGetNotebookInputsNoCells() {
	path := filepath.Join("testdata", "empty_notebook.ipynb.txt")
	inputs, err := getNotebookFileInputs(afero.NewOsFs(), path)
	s.NotNil(err)
	s.ErrorIs(err, errNoCellsInNotebook)
	s.Equal("", inputs)
}

func (s *NotebookDetectorSuite) TestInferTypePlainNotebook() {
	filename := "my_notebook.ipynb"
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, filename, notebookWithCell("import sys\nprint(sys.executable)\n"), 0600)
	s.Nil(err)

	detector := NewNotebookDetector()
	t, err := detector.InferType(fs, filename)
	s.Nil(err)
	s.Equal(&ContentType{
		appMode:    apptypes.StaticJupyterMode,
		entrypoint: filename,
		runtimes:   []Runtime{PythonRuntime},
	}, t)
}

func (s *NotebookDetectorSuite) TestInferTypeVoilaNotebook() {
	filename := "my_notebook.ipynb"
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, filename, notebookWithCell("import ipywidgets\nprint('hello')\n"), 0600)
	s.Nil(err)

	detector := NewNotebookDetector()
	t, err := detector.InferType(fs, filename)
	s.Nil(err)
	s.Equal(&ContentType{
		appMode:    apptypes.JupyterVoilaMode,
		entrypoint: filename,
		runtimes:   []Runtime{PythonRuntime},
	}, t)
}

func (s *NotebookDetectorSuite) TestInferTypeNonNotebook() {
	filename := "app.py"
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, filename, notebookWithCell("import ipywidgets\nprint('hello')\n"), 0600)
	s.Nil(err)

	detector := NewNotebookDetector()
	t, err := detector.InferType(fs, filename)
	s.Nil(err)
	s.Nil(t)
}

func (s *NotebookDetectorSuite) TestInferTypeFsErr() {
	filename := "my_notebook.ipynb"
	fs := afero.NewMemMapFs()
	detector := NewNotebookDetector()
	t, err := detector.InferType(fs, filename)
	s.NotNil(err)
	s.ErrorIs(err, os.ErrNotExist)
	s.Nil(t)
}

func (s *NotebookDetectorSuite) TestInferTypeBadNotebook() {
	filename := "my_notebook.ipynb"
	fs := afero.NewMemMapFs()
	// oops, content is not in notebook format
	err := afero.WriteFile(fs, filename, []byte("import ipywidgets\nprint('hello')\n"), 0600)
	s.Nil(err)

	detector := NewNotebookDetector()
	t, err := detector.InferType(fs, filename)
	s.NotNil(err)
	s.Nil(t)
}
