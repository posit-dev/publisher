package interpreters

import (
	"testing"

	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

// Copyright (C) 2025 by Posit Software, PBC.

type RRequiresSuite struct {
	utiltest.Suite
	base util.AbsolutePath
	cwd  util.AbsolutePath
	fs   afero.Fs
}

func TestRRequiresSuite(t *testing.T) {
	suite.Run(t, new(RRequiresSuite))
}

func (s *RRequiresSuite) SetupTest() {
	cwd, err := util.Getwd(s.fs)
	s.NoError(err)
	s.cwd = cwd

	s.fs = afero.NewOsFs()

	s.base = s.cwd.Join("..", "..", "test", "sample-content").WithFs(s.fs)
}

func (s *RRequiresSuite) TestGetRRequiresDESCRIPTION() {
	fastapi_path := s.base.Join("shinyapp")
	pyRequires := NewRProjectRRequires(fastapi_path)

	pythonRequires, err := pyRequires.GetRVersionRequirement()
	s.NoError(err)
	s.NotEmpty(pythonRequires)
	s.Equal(">= 3.5.0", pythonRequires)
}

func (s *RRequiresSuite) TestGetRRequiresRenvLock() {
	gradio_path := s.base.Join("quarto-proj-r")
	pyRequires := NewRProjectRRequires(gradio_path)

	pythonRequires, err := pyRequires.GetRVersionRequirement()
	s.NoError(err)
	s.NotEmpty(pythonRequires)
	s.Equal("~=4.3.0", pythonRequires)
}
