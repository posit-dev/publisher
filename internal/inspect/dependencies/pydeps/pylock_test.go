package pydeps

// Copyright (C) 2026 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type PyLockSuite struct {
	utiltest.Suite
	cwd util.AbsolutePath
	fs  afero.Fs
}

func TestPyLockSuite(t *testing.T) {
	suite.Run(t, new(PyLockSuite))
}

func (s *PyLockSuite) SetupTest() {
	s.fs = afero.NewMemMapFs()
	cwd, err := util.Getwd(s.fs)
	s.NoError(err)
	s.cwd = cwd
	err = cwd.MkdirAll(0700)
	s.NoError(err)
}

func (s *PyLockSuite) TestReadPyLockDependencies_NoFile() {
	deps, err := ReadPyLockDependencies(s.cwd)
	s.NoError(err)
	s.Nil(deps)
}

func (s *PyLockSuite) TestReadPyLockDependencies_WithPackages() {
	path := s.cwd.Join("pylock.toml")
	content := `lock-version = "1.0"
created-by = "uv"

[[packages]]
name = "requests"
version = "2.31.0"

[[packages]]
name = "urllib3"
version = "2.1.0"
`
	err := path.WriteFile([]byte(content), 0666)
	s.NoError(err)

	deps, err := ReadPyLockDependencies(s.cwd)
	s.NoError(err)
	s.Equal([]string{"requests==2.31.0", "urllib3==2.1.0"}, deps)
}

func (s *PyLockSuite) TestReadPyLockDependencies_SkipsPackagesWithoutVersion() {
	path := s.cwd.Join("pylock.toml")
	content := `lock-version = "1.0"
created-by = "uv"

[[packages]]
name = "mystery"

[[packages]]
name = "flask"
version = "3.0.2"
`
	err := path.WriteFile([]byte(content), 0666)
	s.NoError(err)

	deps, err := ReadPyLockDependencies(s.cwd)
	s.NoError(err)
	s.Equal([]string{"flask==3.0.2"}, deps)
}

func (s *PyLockSuite) TestReadPyLockDependencies_SkipsPackagesWithoutName() {
	path := s.cwd.Join("pylock.toml")
	content := `lock-version = "1.0"
created-by = "uv"

[[packages]]
version = "1.0.0"

[[packages]]
name = "flask"
version = "3.0.2"
`
	err := path.WriteFile([]byte(content), 0666)
	s.NoError(err)

	deps, err := ReadPyLockDependencies(s.cwd)
	s.NoError(err)
	s.Equal([]string{"flask==3.0.2"}, deps)
}

func (s *PyLockSuite) TestReadPyLockDependencies_EmptyPackages() {
	path := s.cwd.Join("pylock.toml")
	content := `lock-version = "1.0"
created-by = "uv"
`
	err := path.WriteFile([]byte(content), 0666)
	s.NoError(err)

	deps, err := ReadPyLockDependencies(s.cwd)
	s.NoError(err)
	s.Nil(deps)
}

func (s *PyLockSuite) TestReadPyLockDependencies_InvalidToml() {
	path := s.cwd.Join("pylock.toml")
	err := path.WriteFile([]byte("not valid toml {{{"), 0666)
	s.NoError(err)

	deps, err := ReadPyLockDependencies(s.cwd)
	s.NoError(err)
	s.Nil(deps)
}

func (s *PyLockSuite) TestHasPyLock_True() {
	path := s.cwd.Join("pylock.toml")
	err := path.WriteFile([]byte("lock-version = \"1.0\"\n"), 0666)
	s.NoError(err)

	has, err := HasPyLock(s.cwd)
	s.NoError(err)
	s.True(has)
}

func (s *PyLockSuite) TestHasPyLock_False() {
	has, err := HasPyLock(s.cwd)
	s.NoError(err)
	s.False(has)
}
