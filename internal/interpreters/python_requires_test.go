package interpreters

import (
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
	s.Equal(">=3.8, <3.12", pythonRequires)
}
