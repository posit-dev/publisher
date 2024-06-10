package pydeps

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"testing"

	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type NotebookContentsSuite struct {
	utiltest.Suite
	cwd util.AbsolutePath
}

func TestNotebookContentsSuite(t *testing.T) {
	suite.Run(t, new(NotebookContentsSuite))
}

func (s *NotebookContentsSuite) SetupTest() {
	cwd, err := util.Getwd(nil)
	s.NoError(err)
	s.cwd = cwd
}

func (s *NotebookContentsSuite) TestGetNotebookFileInputs() {
	path := s.cwd.Join("testdata", "good_notebook.ipynb")

	inputs, err := GetNotebookFileInputs(path)
	s.Nil(err)
	s.Equal("import sys\n\nprint(sys.executable)\n\nprint('Summing')\n\n123 + 456\n", inputs)
}

func (s *NotebookContentsSuite) TestGetNotebookFileInputsErr() {
	afs := utiltest.NewMockFs()
	path := s.cwd.Join("testdata", "good_notebook.ipynb").WithFs(afs)

	testError := errors.New("test error from Open")
	afs.On("Open", mock.Anything).Return(nil, testError)
	inputs, err := GetNotebookFileInputs(path)
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Equal("", inputs)
}

func (s *NotebookContentsSuite) TestGetNotebookInputsNoCells() {
	path := s.cwd.Join("testdata", "empty_notebook.ipynb")

	inputs, err := GetNotebookFileInputs(path)
	s.NoError(err)
	s.Equal("", inputs)
}
