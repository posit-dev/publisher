package gitignore

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
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
	// gitignore.IgnoreList uses relative paths internally
	// and expects to be able to call Abs on them.
	cwd.MkdirAll(0700)
}

func (s *WalkerSuite) TestNewExcludingWalker() {
	w := NewExcludingWalker(s.cwd)
	s.NotNil(w)
}

func (s *WalkerSuite) TestNewWalkerBadIgnoreFile() {
	s.cwd.Join(".git").Mkdir(0700)
	giPath := s.cwd.Join(".positignore")
	data := []byte("[Z-A]\n")
	err := giPath.WriteFile(data, 0600)
	s.NoError(err)

	w := NewExcludingWalker(s.cwd)
	s.NotNil(w)

	err = w.Walk(s.cwd, func(util.AbsolutePath, fs.FileInfo, error) error {
		return nil
	})
	s.NotNil(err)
}

func (s *WalkerSuite) TestWalkErrorLoadingPositIgnore() {
	positIgnorePath := s.cwd.Join(".positignore")
	err := positIgnorePath.WriteFile([]byte("[Z-A]"), 0600)
	s.NoError(err)

	w := NewExcludingWalker(s.cwd)
	s.NotNil(w)

	err = w.Walk(s.cwd, func(path util.AbsolutePath, info fs.FileInfo, err error) error {
		return nil
	})
	s.ErrorContains(err, "error loading ignore file")
}

func (s *WalkerSuite) TestWalk() {
	baseDir := s.cwd.Join("test", "dir")

	// a Python env with a nonstandard name that contains bin/python
	envDir := baseDir.Join("notnamedenv")
	err := envDir.Join("bin").MkdirAll(0777)
	s.NoError(err)
	err = envDir.Join("bin", "python").WriteFile(nil, 0777)
	s.NoError(err)

	// a dir excluded by .positignore
	excludedDir := baseDir.Join("excluded", "subdir")
	err = excludedDir.MkdirAll(0777)
	s.NoError(err)
	excludedFile := excludedDir.Join("dontreadthis")
	err = excludedFile.WriteFile([]byte("this is an excluded file"), 0600)
	s.NoError(err)

	positIgnorePath := baseDir.Join(".positignore")
	err = positIgnorePath.WriteFile([]byte("excluded/\n*.csv\n"), 0600)
	s.NoError(err)

	// some files we want to include
	includedDir := baseDir.Join("included")
	err = includedDir.MkdirAll(0777)
	s.NoError(err)
	includedFile := includedDir.Join("includeme")
	err = includedFile.WriteFile([]byte("this is an included file"), 0600)
	s.NoError(err)

	// files excluded by .positignore
	for i := 0; i < 3; i++ {
		csvPath := includedDir.Join(fmt.Sprintf("%d.csv", i))
		err = csvPath.WriteFile(nil, 0600)
		s.NoError(err)
	}

	w := NewExcludingWalker(s.cwd)
	s.NotNil(w)

	seen := []util.RelativePath{}
	err = w.Walk(baseDir, func(path util.AbsolutePath, info fs.FileInfo, err error) error {
		s.NoError(err)
		relPath, err := path.Rel(s.cwd)
		s.NoError(err)
		seen = append(seen, relPath)
		return nil
	})
	s.NoError(err)
	dirPath := util.NewRelativePath("test", s.fs).Join("dir")
	s.Equal([]util.RelativePath{
		dirPath,
		dirPath.Join(".positignore"),
		dirPath.Join("included"),
		dirPath.Join("included", "includeme"),
	}, seen)
}
