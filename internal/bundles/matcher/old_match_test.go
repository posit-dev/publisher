package matcher

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type MatchListSuite struct {
	utiltest.Suite

	fs  afero.Fs
	cwd util.AbsolutePath
}

func TestMatchListSuite(t *testing.T) {
	suite.Run(t, new(MatchListSuite))
}

func (s *MatchListSuite) SetupTest() {
	s.fs = afero.NewMemMapFs()
	cwd, err := util.Getwd(s.fs)
	s.NoError(err)
	s.cwd = cwd
	cwd.MkdirAll(0700)
}

func (s *MatchListSuite) TestNew() {
	matchList, err := NewMatchList(s.cwd, []string{"*.bak"})
	s.NoError(err)
	s.NotNil(matchList)
	s.NotNil(matchList.files)
}

func (s *MatchListSuite) TestNewError() {
	matchList, err := NewMatchList(s.cwd, []string{"[A-"})
	s.NotNil(err)
	s.Nil(matchList)
}

func (s *MatchListSuite) TestMatch() {
	err := s.cwd.Join(".git").MkdirAll(0700)
	s.NoError(err)

	matchList, err := NewMatchList(s.cwd, []string{"/**", "!*.bak", "!ignoredir/"})
	s.NoError(err)

	m := matchList.Match(s.cwd.Join("app.py"))
	s.NotNil(m)
	s.Equal(MatchSourceBuiltIn, m.Source)
	s.Equal("/**", m.Pattern)
	s.Equal("", m.FilePath.String())
	s.Equal(false, m.Inverted)

	// Non-file matches don't include file info
	m = matchList.Match(s.cwd.Join("app.py.bak"))
	s.NotNil(m)
	s.Equal(MatchSourceBuiltIn, m.Source)
	s.Equal("!*.bak", m.Pattern)
	s.Equal("", m.FilePath.String())
	s.Equal(true, m.Inverted)

	ignoredir := s.cwd.Join("ignoredir")
	err = ignoredir.MkdirAll(0700)
	s.NoError(err)

	m = matchList.Match(ignoredir)
	s.NotNil(m)
	s.Equal(MatchSourceBuiltIn, m.Source)
	s.Equal("!ignoredir/", m.Pattern)
	s.Equal("", m.FilePath.String())
	s.Equal(true, m.Inverted)
}
