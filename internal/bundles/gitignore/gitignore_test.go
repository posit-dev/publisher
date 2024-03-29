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
	cwd util.AbsolutePath
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
	ign, err := NewIgnoreList([]string{"*.bak"})
	s.NoError(err)
	s.NotNil(ign)
	s.NotNil(ign.files)
}

func (s *GitIgnoreSuite) TestNewError() {
	ign, err := NewIgnoreList([]string{"[A-"})
	s.NotNil(err)
	s.Nil(ign)
}

func (s *GitIgnoreSuite) TestMatch() {
	err := s.cwd.Join(".git").MkdirAll(0700)
	s.NoError(err)

	ignoreFilePath := s.cwd.Join(".positignore")
	err = ignoreFilePath.WriteFile([]byte(".Rhistory\nignoreme\n"), 0600)
	s.NoError(err)

	ign, err := NewIgnoreList([]string{"*.bak", "ignoredir/"})
	s.NoError(err)

	err = ign.AddFile(ignoreFilePath)
	s.NoError(err)

	// Match returns nil if no match
	m := ign.Match(s.cwd.Join("app.py"))
	s.Nil(m)

	// File matches include file info
	m = ign.Match(s.cwd.Join(".Rhistory"))
	s.NotNil(m)
	s.Equal(MatchSourceFile, m.Source)
	s.Equal(".Rhistory", m.Pattern)
	s.Equal(ignoreFilePath, m.FilePath)
	s.Equal(1, m.Line)

	// Non-file matches don't include file info
	m = ign.Match(s.cwd.Join("app.py.bak"))
	s.NotNil(m)
	s.Equal(MatchSourceBuiltIn, m.Source)
	s.Equal("*.bak", m.Pattern)
	s.Equal("", m.FilePath.String())
	s.Equal(1, m.Line)

	ignoredir := s.cwd.Join("ignoredir")
	err = ignoredir.MkdirAll(0700)
	s.NoError(err)

	m = ign.Match(ignoredir)
	s.NotNil(m)
	s.Equal(MatchSourceBuiltIn, m.Source)
	s.Equal("ignoredir/", m.Pattern)
	s.Equal("", m.FilePath.String())
	s.Equal(2, m.Line)
}
