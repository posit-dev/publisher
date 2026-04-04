package pydeps

// Copyright (C) 2026 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type UvLockSuite struct {
	utiltest.Suite
	cwd util.AbsolutePath
	fs  afero.Fs
}

func TestUvLockSuite(t *testing.T) {
	suite.Run(t, new(UvLockSuite))
}

func (s *UvLockSuite) SetupTest() {
	s.fs = afero.NewMemMapFs()
	cwd, err := util.Getwd(s.fs)
	s.NoError(err)
	s.cwd = cwd
	err = cwd.MkdirAll(0700)
	s.NoError(err)
}

func (s *UvLockSuite) TestReadUvLockDependencies_NoFile() {
	deps, err := ReadUvLockDependencies(s.cwd)
	s.NoError(err)
	s.Nil(deps)
}

func (s *UvLockSuite) TestReadUvLockDependencies_WithPackages() {
	path := s.cwd.Join("uv.lock")
	content := `version = 1
requires-python = ">=3.12"

[[package]]
name = "my-project"
version = "0.1.0"
source = { editable = "." }

[[package]]
name = "requests"
version = "2.31.0"
source = { registry = "https://pypi.org/simple" }

[[package]]
name = "urllib3"
version = "2.1.0"
source = { registry = "https://pypi.org/simple" }
`
	err := path.WriteFile([]byte(content), 0666)
	s.NoError(err)

	deps, err := ReadUvLockDependencies(s.cwd)
	s.NoError(err)
	s.Equal([]string{"requests==2.31.0", "urllib3==2.1.0"}, deps)
}

func (s *UvLockSuite) TestReadUvLockDependencies_ExcludesVirtualSource() {
	path := s.cwd.Join("uv.lock")
	content := `version = 1

[[package]]
name = "my-project"
version = "0.1.0"
source = { virtual = "." }

[[package]]
name = "flask"
version = "3.0.2"
source = { registry = "https://pypi.org/simple" }
`
	err := path.WriteFile([]byte(content), 0666)
	s.NoError(err)

	deps, err := ReadUvLockDependencies(s.cwd)
	s.NoError(err)
	s.Equal([]string{"flask==3.0.2"}, deps)
}

func (s *UvLockSuite) TestReadUvLockDependencies_SkipsPackagesWithoutVersion() {
	path := s.cwd.Join("uv.lock")
	content := `version = 1

[[package]]
name = "mystery"
source = { registry = "https://pypi.org/simple" }

[[package]]
name = "flask"
version = "3.0.2"
source = { registry = "https://pypi.org/simple" }
`
	err := path.WriteFile([]byte(content), 0666)
	s.NoError(err)

	deps, err := ReadUvLockDependencies(s.cwd)
	s.NoError(err)
	s.Equal([]string{"flask==3.0.2"}, deps)
}

func (s *UvLockSuite) TestReadUvLockDependencies_OnlyRootProject() {
	path := s.cwd.Join("uv.lock")
	content := `version = 1

[[package]]
name = "my-project"
version = "0.1.0"
source = { editable = "." }
`
	err := path.WriteFile([]byte(content), 0666)
	s.NoError(err)

	deps, err := ReadUvLockDependencies(s.cwd)
	s.NoError(err)
	s.Nil(deps)
}

func (s *UvLockSuite) TestReadUvLockDependencies_EmptyFile() {
	path := s.cwd.Join("uv.lock")
	err := path.WriteFile([]byte("version = 1\n"), 0666)
	s.NoError(err)

	deps, err := ReadUvLockDependencies(s.cwd)
	s.NoError(err)
	s.Nil(deps)
}

func (s *UvLockSuite) TestReadUvLockDependencies_InvalidToml() {
	path := s.cwd.Join("uv.lock")
	err := path.WriteFile([]byte("not valid toml {{{"), 0666)
	s.NoError(err)

	deps, err := ReadUvLockDependencies(s.cwd)
	s.NoError(err)
	s.Nil(deps)
}

func (s *UvLockSuite) TestHasUvLock_True() {
	path := s.cwd.Join("uv.lock")
	err := path.WriteFile([]byte("version = 1\n"), 0666)
	s.NoError(err)

	has, err := HasUvLock(s.cwd)
	s.NoError(err)
	s.True(has)
}

func (s *UvLockSuite) TestHasUvLock_False() {
	has, err := HasUvLock(s.cwd)
	s.NoError(err)
	s.False(has)
}
