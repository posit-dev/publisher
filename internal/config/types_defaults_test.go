package config

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"errors"
	"testing"

	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type ConfigFillDefaultsSuite struct {
	suite.Suite
	cwd                      util.AbsolutePath
	log                      logging.Logger
	rInterpreter             interpreters.RInterpreter
	rMissingInterpreter      interpreters.RInterpreter
	pythonInterpreter        interpreters.PythonInterpreter
	pythonMissingInterpreter interpreters.PythonInterpreter
}

func (s *ConfigFillDefaultsSuite) createMockRInterpreter() interpreters.RInterpreter {
	iMock := interpreters.NewMockRInterpreter()
	iMock.On("Init").Return(nil)
	iMock.On("IsRExecutableValid").Return(true)
	iMock.On("GetRExecutable").Return(util.NewAbsolutePath("R", s.cwd.Fs()), nil)
	iMock.On("GetRVersion").Return("1.2.3", nil)
	relPath := util.NewRelativePath("renv.lock", s.cwd.Fs())
	iMock.On("GetLockFilePath").Return(relPath, true, nil)
	iMock.On("GetPackageManager").Return("renv")
	return iMock
}

func (s *ConfigFillDefaultsSuite) createMockRMissingInterpreter() interpreters.RInterpreter {
	iMock := interpreters.NewMockRInterpreter()
	missingError := types.NewAgentError(types.ErrorRExecNotFound, errors.New("no r"), nil)
	iMock.On("Init").Return(nil)
	iMock.On("IsRExecutableValid").Return(false)
	iMock.On("GetRExecutable").Return(util.NewAbsolutePath("", s.cwd.Fs()), missingError)
	iMock.On("GetRVersion").Return("", missingError)
	relPath := util.NewRelativePath("", s.cwd.Fs())
	iMock.On("GetLockFilePath").Return(relPath, false, missingError)
	iMock.On("GetPackageManager").Return("renv")
	return iMock
}

func (s *ConfigFillDefaultsSuite) createMockPythonInterpreter() interpreters.PythonInterpreter {
	iMock := interpreters.NewMockPythonInterpreter()
	iMock.On("IsPythonExecutableValid").Return(true)
	iMock.On("GetPythonExecutable").Return(util.NewAbsolutePath("/bin/python", s.cwd.Fs()), nil)
	iMock.On("GetPythonVersion").Return("1.2.3", nil)
	iMock.On("GetPackageManager").Return("pip")
	iMock.On("GetLockFilePath").Return("requirements.txt", true, nil)
	return iMock
}

func (s *ConfigFillDefaultsSuite) createMockPythonMissingInterpreter() interpreters.PythonInterpreter {
	iMock := interpreters.NewMockPythonInterpreter()
	missingError := types.NewAgentError(types.ErrorPythonExecNotFound, errors.New("no python"), nil)
	iMock.On("IsPythonExecutableValid").Return(false)
	iMock.On("GetPythonExecutable").Return(util.NewAbsolutePath("", s.cwd.Fs()), missingError)
	iMock.On("GetPythonVersion").Return("", missingError)
	iMock.On("GetPackageManager").Return("pip")
	iMock.On("GetLockFilePath").Return("", false, missingError)
	return iMock
}

func (s *ConfigFillDefaultsSuite) SetupTest() {
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
	s.log = logging.New()

	rMock1 := s.createMockRInterpreter()
	s.rInterpreter = rMock1
	rMock2 := s.createMockRMissingInterpreter()
	s.rMissingInterpreter = rMock2
	pythonMock1 := s.createMockPythonInterpreter()
	s.pythonInterpreter = pythonMock1
	pythonMock2 := s.createMockPythonMissingInterpreter()
	s.pythonMissingInterpreter = pythonMock2
}

func TestConfig_FillDefaults(t *testing.T) {
	suite.Run(t, new(ConfigFillDefaultsSuite))
}

func (s *ConfigFillDefaultsSuite) TestFillDefaultsR_Empty() {
	r := &R{}
	r.FillDefaults(s.rInterpreter)
	expectedR := &R{
		Version:        "1.2.3",
		PackageFile:    "renv.lock",
		PackageManager: "renv",
	}
	s.Equal(expectedR, r)
}

func (s *ConfigFillDefaultsSuite) TestFillDefaultsR_NoVersion() {
	r := &R{
		PackageFile:    "lock",
		PackageManager: "another_renv",
	}
	r.FillDefaults(s.rInterpreter)
	expectedR := &R{
		Version:        "1.2.3",
		PackageFile:    "lock",
		PackageManager: "another_renv",
	}
	s.Equal(expectedR, r)
}

func (s *ConfigFillDefaultsSuite) TestFillDefaultsR_NoPackageManager() {
	r := &R{
		Version:     "9.9.9",
		PackageFile: "lock",
	}
	r.FillDefaults(s.rInterpreter)
	expectedR := &R{
		Version:        "9.9.9",
		PackageFile:    "lock",
		PackageManager: "renv",
	}
	s.Equal(expectedR, r)
}

func (s *ConfigFillDefaultsSuite) TestFillDefaultsR_NoPackageFile() {
	r := &R{
		Version:        "9.9.9",
		PackageManager: "another_renv",
	}
	r.FillDefaults(s.rInterpreter)
	expectedR := &R{
		Version:        "9.9.9",
		PackageFile:    "renv.lock",
		PackageManager: "another_renv",
	}
	s.Equal(expectedR, r)
}

func (s *ConfigFillDefaultsSuite) TestFillDefaultsR_NoDefaultsNeeded() {
	r := &R{
		Version:        "9.9.9",
		PackageFile:    "lock",
		PackageManager: "another_renv",
	}
	r.FillDefaults(s.rInterpreter)
	expectedR := &R{
		Version:        "9.9.9",
		PackageFile:    "lock",
		PackageManager: "another_renv",
	}
	s.Equal(expectedR, r)
}

func (s *ConfigFillDefaultsSuite) TestFillDefaultsR_NoInterpreter() {
	r := &R{
		Version:        "9.9.9",
		PackageFile:    "lock",
		PackageManager: "another_renv",
	}
	r.FillDefaults(s.rMissingInterpreter)
	expectedR := &R{
		Version:        "9.9.9",
		PackageFile:    "lock",
		PackageManager: "another_renv",
	}
	s.Equal(expectedR, r)

	r = &R{}
	r.FillDefaults(s.rMissingInterpreter)
	expectedR = &R{}
	s.Equal(expectedR, r)
}

func (s *ConfigFillDefaultsSuite) TestFillDefaultsPython_Empty() {
	p := &Python{}
	p.FillDefaults(s.pythonInterpreter)
	expectedPython := &Python{
		Version:        "1.2.3",
		PackageFile:    "requirements.txt",
		PackageManager: "pip",
	}
	s.Equal(expectedPython, p)
}

func (s *ConfigFillDefaultsSuite) TestFillDefaultsPython_NoVersion() {
	p := &Python{
		PackageFile:    "requirements.txt",
		PackageManager: "pip",
	}
	p.FillDefaults(s.pythonInterpreter)
	expectedPython := &Python{
		Version:        "1.2.3",
		PackageFile:    "requirements.txt",
		PackageManager: "pip",
	}
	s.Equal(expectedPython, p)
}

func (s *ConfigFillDefaultsSuite) TestFillDefaultsPython_NoPackageManager() {
	p := &Python{
		Version:     "9.9.9",
		PackageFile: "lock",
	}
	p.FillDefaults(s.pythonInterpreter)
	expectedPython := &Python{
		Version:        "9.9.9",
		PackageFile:    "lock",
		PackageManager: "pip",
	}
	s.Equal(expectedPython, p)
}

func (s *ConfigFillDefaultsSuite) TestFillDefaultsPython_NoPackageFile() {
	p := &Python{
		Version:        "9.9.9",
		PackageManager: "another",
	}
	p.FillDefaults(s.pythonInterpreter)
	expectedPython := &Python{
		Version:        "9.9.9",
		PackageFile:    "requirements.txt",
		PackageManager: "another",
	}
	s.Equal(expectedPython, p)
}

func (s *ConfigFillDefaultsSuite) TestFillDefaultsPython_NoDefaultsNeeded() {
	p := &Python{
		Version:        "9.9.9",
		PackageFile:    "lock",
		PackageManager: "another_pip",
	}
	p.FillDefaults(s.pythonInterpreter)
	expectedPython := &Python{
		Version:        "9.9.9",
		PackageFile:    "lock",
		PackageManager: "another_pip",
	}
	s.Equal(expectedPython, p)
}

func (s *ConfigFillDefaultsSuite) TestFillDefaultsPython_NoInterpreter() {
	p := &Python{
		Version:        "9.9.9",
		PackageFile:    "lock",
		PackageManager: "another_pip",
	}
	p.FillDefaults(s.pythonMissingInterpreter)
	expectedPython := &Python{
		Version:        "9.9.9",
		PackageFile:    "lock",
		PackageManager: "another_pip",
	}
	s.Equal(expectedPython, p)

	p = &Python{}
	p.FillDefaults(s.pythonMissingInterpreter)
	expectedPython = &Python{}
	s.Equal(expectedPython, p)
}
