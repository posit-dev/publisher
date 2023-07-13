package bundles

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
	cwd util.Path
}

func TestWalkerSuite(t *testing.T) {
	suite.Run(t, new(WalkerSuite))
}

func (s *WalkerSuite) SetupTest() {
	s.fs = afero.NewMemMapFs()
	cwd, err := util.Getwd(s.fs)
	s.Nil(err)
	s.cwd = cwd

	// Create a virtual version of the cwd so NewWalker
	// can Chdir there. This is needed because the
	// gitignore.IgnoreList uses relative paths internally
	// and expects to be able to call Abs on them.
	cwd.MkdirAll(0700)
}

func (s *WalkerSuite) TestNewWalker() {
	w, err := NewBundlingWalker(s.cwd, []string{"*.log"})
	s.Nil(err)
	s.NotNil(w)
}

func (s *WalkerSuite) TestNewWalkerBadGitignore() {
	s.cwd.Join(".git").Mkdir(0700)
	giPath := s.cwd.Join(".gitignore")
	data := []byte("[Z-A]\n")
	err := giPath.WriteFile(data, 0600)
	s.Nil(err)

	w, err := NewBundlingWalker(s.cwd, nil)
	s.NotNil(err)
	s.Nil(w)
}

func (s *WalkerSuite) TestNewWalkerBadIgnore() {
	w, err := NewBundlingWalker(s.cwd, []string{"[Z-A]"})
	s.NotNil(err)
	s.Nil(w)
}

func (s *WalkerSuite) TestWalkErrorLoadingRscignore() {
	rscIgnorePath := s.cwd.Join(".rscignore")
	err := rscIgnorePath.WriteFile([]byte("[Z-A]"), 0600)
	s.Nil(err)

	w, err := NewBundlingWalker(s.cwd, nil)
	s.Nil(err)
	s.NotNil(w)

	err = w.Walk(s.cwd, func(path util.Path, info fs.FileInfo, err error) error {
		return nil
	})
	s.ErrorContains(err, "error loading .rscignore file")
}

func (s *WalkerSuite) TestWalk() {
	baseDir := s.cwd.Join("test", "dir")

	// a Python env with a nonstandard name that contains bin/python
	envDir := baseDir.Join("notnamedenv")
	err := envDir.Join("bin").MkdirAll(0777)
	s.Nil(err)
	err = envDir.Join("bin", "python").WriteFile(nil, 0777)
	s.Nil(err)

	// a dir excluded by .rscignore
	excludedDir := baseDir.Join("excluded", "subdir")
	err = excludedDir.MkdirAll(0777)
	s.Nil(err)
	excludedFile := excludedDir.Join("dontreadthis")
	err = excludedFile.WriteFile([]byte("this is an excluded file"), 0600)
	s.Nil(err)

	rscIgnorePath := baseDir.Join(".rscignore")
	err = rscIgnorePath.WriteFile([]byte("excluded/\n*.csv\n"), 0600)
	s.Nil(err)

	// some files we want to include
	includedDir := baseDir.Join("included")
	err = includedDir.MkdirAll(0777)
	s.Nil(err)
	includedFile := includedDir.Join("includeme")
	err = includedFile.WriteFile([]byte("this is an included file"), 0600)
	s.Nil(err)

	// files excluded by .rscignore
	for i := 0; i < 3; i++ {
		csvPath := includedDir.Join(fmt.Sprintf("%d.csv", i))
		err = csvPath.WriteFile(nil, 0600)
		s.Nil(err)
	}

	w, err := NewBundlingWalker(s.cwd, nil)
	s.Nil(err)
	s.NotNil(w)

	seen := []util.Path{}
	err = w.Walk(baseDir, func(path util.Path, info fs.FileInfo, err error) error {
		s.Nil(err)
		relPath, err := path.Rel(s.cwd)
		s.Nil(err)
		seen = append(seen, relPath)
		return nil
	})
	s.Nil(err)
	s.Equal([]util.Path{
		util.NewPath("test/dir", s.fs),
		util.NewPath("test/dir/.rscignore", s.fs),
		util.NewPath("test/dir/included", s.fs),
		util.NewPath("test/dir/included/includeme", s.fs),
	}, seen)
}
