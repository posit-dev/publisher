package gitignore

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type GitIgnoreSuite struct {
	utiltest.Suite

	fs  afero.Fs
	cwd util.Path
}

func TestGitIgnoreSuite(t *testing.T) {
	suite.Run(t, new(GitIgnoreSuite))
}

func (s *GitIgnoreSuite) SetupTest() {
	s.fs = afero.NewMemMapFs()
	cwd, err := util.Getwd(s.fs)
	s.NoError(err)
	s.cwd = cwd

	// Create a virtual version of the cwd because the
	// gitignore.IgnoreList uses relative paths internally
	// and expects to be able to call Abs on them.
	cwd.MkdirAll(0700)
}

func (s *GitIgnoreSuite) TestNew() {
	ign := New(s.cwd)
	s.NotNil(ign.files)
	s.NotNil(ign.cwd)
	s.NotNil(ign.fs)
}

func (s *GitIgnoreSuite) TestMatch() {
	err := s.cwd.Join(".git").MkdirAll(0700)
	s.NoError(err)

	ignoreFilePath := s.cwd.Join(".positignore")
	err = ignoreFilePath.WriteFile([]byte(".Rhistory\nignoreme\n"), 0600)
	s.NoError(err)

	ign, err := From(ignoreFilePath)
	s.NoError(err)

	err = ign.AppendGlobs([]string{"*.bak"}, MatchSourceUser)
	s.NoError(err)

	// Match returns nil if no match
	m, err := ign.Match("app.py")
	s.NoError(err)
	s.Nil(m)

	// File matches include file info
	m, err = ign.Match(".Rhistory")
	s.NoError(err)
	s.NotNil(m)
	s.Equal(MatchSourceFile, m.Source)
	s.Equal(".Rhistory", m.Pattern)
	s.Equal(".positignore", m.FilePath)
	s.Equal(1, m.Line)

	// Non-file matches don't include file info
	m, err = ign.Match("app.py.bak")
	s.NoError(err)
	s.NotNil(m)
	s.Equal(MatchSourceUser, m.Source)
	s.Equal("*.bak", m.Pattern)
	s.Equal("", m.FilePath)
	s.Equal(0, m.Line)

	ignoredir := s.cwd.Join("ignoredir")
	err = ignoredir.MkdirAll(0700)
	s.NoError(err)
	err = ign.AppendGlobs([]string{"ignoredir/"}, MatchSourceUser)
	s.NoError(err)

	m, err = ign.Match(ignoredir.Path())
	s.NoError(err)
	s.NotNil(m)
	s.Equal(MatchSourceUser, m.Source)
	s.Equal("ignoredir/", m.Pattern)
	s.Equal("", m.FilePath)
	s.Equal(0, m.Line)
}
