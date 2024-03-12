package pydeps

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"testing"

	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type NotebookContentsSuite struct {
	utiltest.Suite
}

func TestNotebookContentsSuite(t *testing.T) {
	suite.Run(t, new(NotebookContentsSuite))
}

func (s *NotebookContentsSuite) TestGetNotebookFileInputs() {
	path, err := util.NewPath("testdata", nil).Join("good_notebook.ipynb").Abs()
	s.NoError(err)

	inputs, err := GetNotebookFileInputs(path)
	s.Nil(err)
	s.Equal("import sys\nprint(sys.executable)\nprint('Summing')\n123 + 456\n", inputs)
}

func (s *NotebookContentsSuite) TestGetNotebookFileInputsErr() {
	fs := utiltest.NewMockFs()
	path, err := util.NewPath("testdata", fs).Join("good_notebook.ipynb").Abs()
	s.NoError(err)

	testError := errors.New("test error from Open")
	fs.On("Open", mock.Anything).Return(nil, testError)
	inputs, err := GetNotebookFileInputs(path)
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Equal("", inputs)
}

func (s *NotebookContentsSuite) TestGetNotebookInputsNoCells() {
	path, err := util.NewPath("testdata", nil).Join("empty_notebook.ipynb").Abs()
	s.NoError(err)

	inputs, err := GetNotebookFileInputs(path)
	s.NoError(err)
	s.Equal("", inputs)
}
