package pydeps

// Copyright (C) 2026 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type PyProjectSuite struct {
	utiltest.Suite
	cwd util.AbsolutePath
	fs  afero.Fs
}

func TestPyProjectSuite(t *testing.T) {
	suite.Run(t, new(PyProjectSuite))
}

func (s *PyProjectSuite) SetupTest() {
	s.fs = afero.NewMemMapFs()
	cwd, err := util.Getwd(s.fs)
	s.NoError(err)
	s.cwd = cwd
	err = cwd.MkdirAll(0700)
	s.NoError(err)
}

func (s *PyProjectSuite) TestReadPyProjectDependencies_NoPyProjectToml() {
	deps, err := ReadPyProjectDependencies(s.cwd, nil)
	s.NoError(err)
	s.Nil(deps)
}

func (s *PyProjectSuite) TestReadPyProjectDependencies_NoProjectSection() {
	path := s.cwd.Join("pyproject.toml")
	err := path.WriteFile([]byte("[tool.ruff]\nline-length = 88\n"), 0666)
	s.NoError(err)

	deps, err := ReadPyProjectDependencies(s.cwd, nil)
	s.NoError(err)
	s.Nil(deps)
}

func (s *PyProjectSuite) TestReadPyProjectDependencies_NoDependencies() {
	path := s.cwd.Join("pyproject.toml")
	err := path.WriteFile([]byte("[project]\nname = \"myproject\"\nversion = \"1.0\"\n"), 0666)
	s.NoError(err)

	deps, err := ReadPyProjectDependencies(s.cwd, nil)
	s.NoError(err)
	s.Nil(deps)
}

func (s *PyProjectSuite) TestReadPyProjectDependencies_DirectDependencies() {
	path := s.cwd.Join("pyproject.toml")
	content := `[project]
name = "myproject"
dependencies = [
  "requests>=2.20",
  "numpy>=1.21",
  "pandas",
]
`
	err := path.WriteFile([]byte(content), 0666)
	s.NoError(err)

	deps, err := ReadPyProjectDependencies(s.cwd, nil)
	s.NoError(err)
	s.Equal([]string{"requests>=2.20", "numpy>=1.21", "pandas"}, deps)
}

func (s *PyProjectSuite) TestReadPyProjectDependencies_EmptyDependencies() {
	path := s.cwd.Join("pyproject.toml")
	err := path.WriteFile([]byte("[project]\nname = \"myproject\"\ndependencies = []\n"), 0666)
	s.NoError(err)

	deps, err := ReadPyProjectDependencies(s.cwd, nil)
	s.NoError(err)
	s.Equal([]string{}, deps)
}

func (s *PyProjectSuite) TestReadPyProjectDependencies_WithOptionalGroups() {
	path := s.cwd.Join("pyproject.toml")
	content := `[project]
name = "myproject"
dependencies = ["requests"]

[project.optional-dependencies]
dev = ["pytest", "black"]
docs = ["sphinx"]
`
	err := path.WriteFile([]byte(content), 0666)
	s.NoError(err)

	deps, err := ReadPyProjectDependencies(s.cwd, []string{"dev"})
	s.NoError(err)
	s.Equal([]string{"requests", "pytest", "black"}, deps)
}

func (s *PyProjectSuite) TestReadPyProjectDependencies_MultipleOptionalGroups() {
	path := s.cwd.Join("pyproject.toml")
	content := `[project]
name = "myproject"
dependencies = ["requests"]

[project.optional-dependencies]
dev = ["pytest"]
docs = ["sphinx"]
`
	err := path.WriteFile([]byte(content), 0666)
	s.NoError(err)

	deps, err := ReadPyProjectDependencies(s.cwd, []string{"dev", "docs"})
	s.NoError(err)
	s.Equal([]string{"requests", "pytest", "sphinx"}, deps)
}

func (s *PyProjectSuite) TestReadPyProjectDependencies_NonexistentGroup() {
	path := s.cwd.Join("pyproject.toml")
	content := `[project]
name = "myproject"
dependencies = ["requests"]

[project.optional-dependencies]
dev = ["pytest"]
`
	err := path.WriteFile([]byte(content), 0666)
	s.NoError(err)

	deps, err := ReadPyProjectDependencies(s.cwd, []string{"nonexistent"})
	s.NoError(err)
	s.Equal([]string{"requests"}, deps)
}

func (s *PyProjectSuite) TestReadPyProjectDependencies_InvalidToml() {
	path := s.cwd.Join("pyproject.toml")
	err := path.WriteFile([]byte("this is not valid toml {{{"), 0666)
	s.NoError(err)

	deps, err := ReadPyProjectDependencies(s.cwd, nil)
	s.NoError(err)
	s.Nil(deps)
}

func (s *PyProjectSuite) TestHasPyProjectDependencies_True() {
	path := s.cwd.Join("pyproject.toml")
	content := `[project]
name = "myproject"
dependencies = ["requests"]
`
	err := path.WriteFile([]byte(content), 0666)
	s.NoError(err)

	has, err := HasPyProjectDependencies(s.cwd)
	s.NoError(err)
	s.True(has)
}

func (s *PyProjectSuite) TestHasPyProjectDependencies_NoDeps() {
	path := s.cwd.Join("pyproject.toml")
	err := path.WriteFile([]byte("[project]\nname = \"myproject\"\n"), 0666)
	s.NoError(err)

	has, err := HasPyProjectDependencies(s.cwd)
	s.NoError(err)
	s.False(has)
}

func (s *PyProjectSuite) TestHasPyProjectDependencies_NoFile() {
	has, err := HasPyProjectDependencies(s.cwd)
	s.NoError(err)
	s.False(has)
}
