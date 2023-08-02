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

	gitignorePath := s.cwd.Join(".gitignore")
	err = gitignorePath.WriteFile([]byte(".Rhistory\nignoreme\n"), 0600)
	s.NoError(err)

	ign := New(s.cwd)
	err = ign.AppendGlobs([]string{"*.bak"}, MatchSourceUser)
	s.NoError(err)

	err = ign.AppendGit()
	s.NoError(err)

	// Match returns nil if no match
	m := ign.Match("app.py")
	s.Nil(m)

	// File matches include file info
	m = ign.Match(".Rhistory")
	s.NotNil(m)
	s.Equal(MatchSourceFile, m.Source)
	s.Equal(".Rhistory", m.Pattern)
	s.Equal(gitignorePath, m.FilePath)
	s.Equal(1, m.Line)

	// Non-file matches don't include file info
	m = ign.Match("app.py.bak")
	s.NotNil(m)
	s.Equal(MatchSourceUser, m.Source)
	s.Equal("*.bak", m.Pattern)
	s.Equal(util.Path{}, m.FilePath)
	s.Equal(0, m.Line)
}
