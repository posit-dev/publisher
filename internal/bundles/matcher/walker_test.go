package matcher

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io/fs"
	"testing"

	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type WalkerSuite struct {
	utiltest.Suite

	fs  afero.Fs
	cwd util.AbsolutePath
}

func TestWalkerSuite(t *testing.T) {
	suite.Run(t, new(WalkerSuite))
}

func (s *WalkerSuite) SetupTest() {
	s.fs = afero.NewMemMapFs()
	cwd, err := util.Getwd(s.fs)
	s.NoError(err)
	s.cwd = cwd

	// Create a virtual version of the cwd so NewWalker
	// can Chdir there. This is needed because the
	// matcher.MatchList uses relative paths internally
	// and expects to be able to call Abs on them.
	cwd.MkdirAll(0700)
}

func (s *WalkerSuite) TestNewMatchingWalker() {
	w, err := NewMatchingWalker(nil, s.cwd)
	s.NoError(err)
	s.NotNil(w)
}

func (s *WalkerSuite) TestWalk() {
	baseDir := s.cwd.Join("test", "dir")

	// a Python env with a nonstandard name that contains bin/python
	envDir := baseDir.Join("notnamedenv")
	err := envDir.Join("bin").MkdirAll(0777)
	s.NoError(err)
	err = envDir.Join("bin", "python").WriteFile(nil, 0777)
	s.NoError(err)

	// some files we want to include
	includedDir := baseDir.Join("included")
	err = includedDir.MkdirAll(0777)
	s.NoError(err)

	includedFile := includedDir.Join("includeme")
	err = includedFile.WriteFile([]byte("this is an included file"), 0600)
	s.NoError(err)

	// This will be excluded by default
	err = baseDir.Join("manifest.json").WriteFile(nil, 0777)
	s.NoError(err)

	w, err := NewMatchingWalker([]string{"/**"}, s.cwd)
	s.NoError(err)
	s.NotNil(w)

	seen := []string{}
	err = w.Walk(baseDir, func(path util.AbsolutePath, info fs.FileInfo, err error) error {
		s.NoError(err)
		relPath, err := path.Rel(s.cwd)
		s.NoError(err)
		seen = append(seen, relPath.String())
		return nil
	})
	s.NoError(err)
	dirPath := util.NewRelativePath("test", s.fs).Join("dir")
	s.Equal([]string{
		dirPath.String(),
		dirPath.Join("included").String(),
		dirPath.Join("included", "includeme").String(),
	}, seen)
}
