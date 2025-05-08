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

func (s *RRequiresSuite) TestGetRRequiresDESCRIPTIONDepends() {
	cases := []struct {
		input    string
		expected string
	}{
		{"Depends: package1, package2, package3", ""},
		{"Depends: package1\n package2\n package3", ""},
		{"Depends: package1\n\tpackage2\n\tpackage3", ""},
		{"Depends: package1, R (>3.5), package3", ">3.5"},
		{"Depends: package1\n R (>3.5)\n package3", ">3.5"},
		{"Depends: package1\n\tR (>7.3)\n\tpackage3", ">7.3"},
		{"Depends: package1\n tinyR (<3.5)\n package3", ""},
	}

	tmpDirPath, _ := util.NewAbsolutePath(os.TempDir(), s.fs).TempDir("test-r-requires")
	tmpDir, _ := tmpDirPath.Abs()
	for _, tcase := range cases {
		versionFile := tmpDir.Join("DESCRIPTION").WithFs(s.fs)
		versionFile.WriteFile([]byte(tcase.input), 0644)

		p := NewRProjectRRequires(tmpDir)

		pythonRequires, _ := p.GetRVersionRequirement()
		s.Equal(tcase.expected, pythonRequires)
	}
}
