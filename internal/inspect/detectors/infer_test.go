package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"
	"testing"

	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
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

func (m *MockInferenceHelper) InferEntrypoint(path util.AbsolutePath, suffix string, preferredFilenames ...string) (string, util.AbsolutePath, error) {
	args := m.Called(path, suffix, preferredFilenames)
	return args.String(0), args.Get(1).(util.AbsolutePath), args.Error(2)
}

func (m *MockInferenceHelper) HasPythonImports(r io.Reader, packages []string) (bool, error) {
	args := m.Called(r, packages)
	return args.Bool(0), args.Error(1)
}

func (m *MockInferenceHelper) FileHasPythonImports(path util.AbsolutePath, packages []string) (bool, error) {
	args := m.Called(path, packages)
	return args.Bool(0), args.Error(1)
}
