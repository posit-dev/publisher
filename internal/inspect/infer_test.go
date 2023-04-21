package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type InferSuite struct {
	utiltest.Suite
}

func TestFlaskInfererSuite(t *testing.T) {
	suite.Run(t, new(InferSuite))
}

func (s *InferSuite) TestFileHasPythonImports() {
}

type MockInferenceHelper struct {
	mock.Mock
}

func (m *MockInferenceHelper) InferEntrypoint(fs afero.Fs, path string, suffix string, preferredFilename string) (string, string, error) {
	args := m.Called(fs, path, suffix, preferredFilename)
	return args.String(0), args.String(1), args.Error(2)
}

func (m *MockInferenceHelper) HasPythonImports(r io.Reader, packages []string) (bool, error) {
	args := m.Called(r, packages)
	return args.Bool(0), args.Error(1)
}

func (m *MockInferenceHelper) FileHasPythonImports(fs afero.Fs, path string, packages []string) (bool, error) {
	args := m.Called(fs, path, packages)
	return args.Bool(0), args.Error(1)
}
