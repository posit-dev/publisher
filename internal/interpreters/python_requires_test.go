package interpreters

import (
	"os"
	"testing"

	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

// Copyright (C) 2025 by Posit Software, PBC.

type PythonRequiresSuite struct {
	utiltest.Suite
	base util.AbsolutePath
	cwd  util.AbsolutePath
	fs   afero.Fs
}

func TestPythonRequiresSuite(t *testing.T) {
	suite.Run(t, new(PythonRequiresSuite))
}

func (s *PythonRequiresSuite) SetupTest() {
	cwd, err := util.Getwd(s.fs)
	s.NoError(err)
	s.cwd = cwd

	s.fs = afero.NewOsFs()

	s.base = s.cwd.Join("..", "..", "test", "sample-content").WithFs(s.fs)
}

func (s *PythonRequiresSuite) TestGetPythonRequiresPyProject() {
	fastapi_path := s.base.Join("fastapi-simple")
	pyRequires := NewPyProjectPythonRequires(fastapi_path)

	pythonRequires, err := pyRequires.GetPythonVersionRequirement()
	s.NoError(err)
	s.NotEmpty(pythonRequires)
	s.Equal(">=3.8", pythonRequires)
}

func (s *PythonRequiresSuite) TestGetPythonRequiresSetupCfg() {
	gradio_path := s.base.Join("gradio")
	pyRequires := NewPyProjectPythonRequires(gradio_path)

	pythonRequires, err := pyRequires.GetPythonVersionRequirement()
	s.NoError(err)
	s.NotEmpty(pythonRequires)
	s.Equal(">=3.9", pythonRequires)
}

func (s *PythonRequiresSuite) TestGetPythonRequiresPythonVersion() {
	gradio_path := s.base.Join("shinyapp")
	pyRequires := NewPyProjectPythonRequires(gradio_path)

	pythonRequires, err := pyRequires.GetPythonVersionRequirement()
	s.NoError(err)
	s.NotEmpty(pythonRequires)
	s.Equal(">=3.8,<3.12", pythonRequires)
}

func (s *PythonRequiresSuite) TestGetPythonRequiresPythonVersionAdapt() {
	cases := []struct {
		input    string
		expected string
	}{
		{"3.9.17", "~=3.9.17"},
		{">=3.7", ">=3.7"},
		{"3.8, <3.10", "~=3.8,<3.10"},
		{"==3.11.*", "==3.11.*"},
		{"3.8.0", "~=3.8"},
		{"3.11.10", "~=3.11.10"},
		{"3.11", "~=3.11"},
		{"3.11.0", "~=3.11"},
		{"3.0", "~=3"},
		{"3.0.0", "~=3"},
		{"3.8.*", "==3.8.*"},
		{"  3.9.0  ", "~=3.9"},
		{"~=3.10", "~=3.10"},
		{"< 4.0", "< 4.0"},
		{"3.10rc1", ""},
		{"3.11b2", ""},
		{"3.8a1", ""},
		{"cpython-3.8", ""},
		{"3.9/pypy", ""},
		{"3.10@foo", ""},
		{"", ""},
		{"abc", ""},
		{"3..8", ""},
		{"3.8.1.*", ""},
		{"3.8, 3.8rc1", ""},
		{"3.8, cpython-3.8", ""},
		{"3.8, 3.8", "~=3.8,~=3.8"},
	}

	tmpDirPath, _ := util.NewAbsolutePath(os.TempDir(), s.fs).TempDir("test-python-requires")
	tmpDir, _ := tmpDirPath.Abs()
	for _, tcase := range cases {
		versionFile := tmpDir.Join(".python-version").WithFs(s.fs)
		versionFile.WriteFile([]byte(tcase.input), 0644)

		p := NewPyProjectPythonRequires(tmpDir)

		pythonRequires, _ := p.readPythonVersionFile()
		s.Equal(tcase.expected, pythonRequires)
	}
}
