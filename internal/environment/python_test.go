package environment

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type PythonSuite struct {
	utiltest.Suite
}

func TestPythonSuite(t *testing.T) {
	suite.Run(t, new(PythonSuite))
}

type MockPythonExecutor struct {
	mock.Mock
}

func (m *MockPythonExecutor) runPythonCommand(pythonExecutable string, callArgs []string) ([]byte, error) {
	args := m.Called(pythonExecutable, callArgs)
	data := args.Get(0)
	if data == nil {
		return nil, args.Error(1)
	} else {
		return data.([]byte), args.Error(1)
	}
}

func NewMockPythonExecutor() *MockPythonExecutor {
	return &MockPythonExecutor{}
}

func (s *PythonSuite) TestNewPythonInspector() {
	fs := afero.NewMemMapFs()
	logger := rslog.NewDiscardingLogger()
	inspector := NewPythonInspector(fs, "/myproject", "/usr/bin/python", logger)
	s.Equal("/myproject", inspector.projectDir)
	s.Equal("/usr/bin/python", inspector.pythonPath)
	s.Equal(logger, inspector.logger)
}

func (s *PythonSuite) TestGetPythonVersionFromExecutable() {
	fs := utiltest.NewMockFs()
	logger := rslog.NewDiscardingLogger()
	inspector := NewPythonInspector(fs, "", "/usr/bin/python3", logger)
	executor := NewMockPythonExecutor()
	executor.On("runPythonCommand", "/usr/bin/python3", mock.Anything).Return([]byte("3.10.4"), nil)
	inspector.executor = executor
	version, err := inspector.GetPythonVersion()
	s.Nil(err)
	s.Equal("3.10.4", version)
}

func (s *PythonSuite) TestGetPythonVersionFromExecutableErr() {
	fs := utiltest.NewMockFs()
	logger := rslog.NewDiscardingLogger()
	inspector := NewPythonInspector(fs, "", "/usr/bin/python3", logger)
	executor := NewMockPythonExecutor()
	testError := errors.New("test error from runPythonCommand")
	executor.On("runPythonCommand", "/usr/bin/python3", mock.Anything).Return(nil, testError)
	inspector.executor = executor
	version, err := inspector.GetPythonVersion()
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Equal("", version)
}

func (s *PythonSuite) TestGetPythonVersionFromPATH() {
	fs := utiltest.NewMockFs()
	logger := rslog.NewDiscardingLogger()
	inspector := NewPythonInspector(fs, "", "", logger)
	executor := NewMockPythonExecutor()
	executor.On("runPythonCommand", "python3", mock.Anything).Return([]byte("3.10.4"), nil)
	inspector.executor = executor
	version, err := inspector.GetPythonVersion()
	s.Nil(err)
	s.Equal("3.10.4", version)
}

func (s *PythonSuite) TestGetPythonVersionFromRealDefaultPython() {
	// This test can only run if python3 is on the PATH.
	_, err := exec.LookPath("python3")
	if err != nil {
		s.T().Skip("python3 isn't available on PATH")
	}
	fs := utiltest.NewMockFs()
	logger := rslog.NewDiscardingLogger()
	inspector := NewPythonInspector(fs, "", "", logger)
	version, err := inspector.GetPythonVersion()
	s.Nil(err)
	s.True(strings.HasPrefix(version, "3."))
}

func (s *PythonSuite) TestGetRequirementsFromFile() {
	fs := afero.NewMemMapFs()
	baseDir, err := os.Getwd()
	s.Nil(err)
	err = fs.MkdirAll(baseDir, 0700)
	s.Nil(err)

	fileContent := []byte("numpy\npandas\n")
	reqPath := filepath.Join(baseDir, "requirements.txt")
	err = afero.WriteFile(fs, reqPath, fileContent, 0600)
	s.Nil(err)

	logger := rslog.NewDiscardingLogger()
	inspector := NewPythonInspector(fs, baseDir, "", logger)
	requirements, err := inspector.GetPythonRequirements()
	s.Nil(err)
	s.Equal(fileContent, requirements)
}

func (s *PythonSuite) TestGetRequirementsFromFileErr() {
	fs := utiltest.NewMockFs()
	testError := errors.New("test error from Stat")
	fs.On("Stat", mock.Anything).Return(utiltest.NewMockFileInfo(), testError)
	logger := rslog.NewDiscardingLogger()
	inspector := NewPythonInspector(fs, "/anything", "", logger)
	requirements, err := inspector.GetPythonRequirements()
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Nil(requirements)
}

func (s *PythonSuite) TestGetPythonRequirementsFromExecutable() {
	fs := utiltest.NewMockFs()
	fs.On("Stat", mock.Anything).Return(utiltest.NewMockFileInfo(), os.ErrNotExist)
	logger := rslog.NewDiscardingLogger()
	inspector := NewPythonInspector(fs, "", "/usr/bin/python3", logger)
	executor := NewMockPythonExecutor()
	freezeOutput := []byte("numpy\npandas\n")
	executor.On("runPythonCommand", "/usr/bin/python3", mock.Anything).Return(freezeOutput, nil)
	inspector.executor = executor
	requirements, err := inspector.GetPythonRequirements()
	s.Nil(err)
	s.Equal(freezeOutput, requirements)
}

func (s *PythonSuite) TestGetPythonRequirementsFromExecutableErr() {
	fs := utiltest.NewMockFs()
	fs.On("Stat", mock.Anything).Return(utiltest.NewMockFileInfo(), os.ErrNotExist)
	logger := rslog.NewDiscardingLogger()
	inspector := NewPythonInspector(fs, "", "/nonexistent/python3", logger)
	requirements, err := inspector.GetPythonRequirements()
	s.NotNil(err)
	s.ErrorIs(err, os.ErrNotExist)
	s.Nil(requirements)
}
