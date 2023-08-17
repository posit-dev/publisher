package paths

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"
	"testing"

	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type ServicesSuite struct {
	utiltest.Suite
	log rslog.Logger
}

func TestServicesSuite(t *testing.T) {
	suite.Run(t, new(ServicesSuite))
}

func (s *ServicesSuite) SetupSuite() {
	s.log = rslog.NewDiscardingLogger()
}

func (s *ServicesSuite) TestCreatePathsService() {
	afs := afero.NewMemMapFs()
	base := util.NewPath("", afs)
	service := CreatePathsService(base, afs, s.log)
	s.NotNil(service)
}

func (s *ServicesSuite) TestPathsService_IsSafe() {
	afs := afero.NewMemMapFs()
	base := util.NewPath("", afs)
	service := CreatePathsService(base, afs, s.log)
	ok, err := service.IsSafe(base)
	s.True(ok)
	s.Nil(err)
}

func (s *ServicesSuite) TestPathsService_isSymlink_True() {
	f, err := os.CreateTemp("", "file")
	if err != nil {
		s.Nil(err)
	}
	defer f.Close()
	defer os.Remove(f.Name())

	// create a file for the symbolic link and then delete it
	l, err := os.CreateTemp("", "symlink")
	if err != nil {
		s.Nil(err)
	}
	l.Close()
	os.Remove(l.Name())

	// use the now delete file name as the symbolic link name
	// this ensures that the symoblic link lives in the temporary directory
	os.Symlink(f.Name(), l.Name())
	defer os.Remove(l.Name())

	afs := afero.NewOsFs()

	fpath := util.NewPath(f.Name(), afs)
	lpath := util.NewPath(l.Name(), afs)

	ps := PathsService{fpath, afs, s.log}
	ok, err := ps.isSymlink(lpath)
	s.Nil(err)
	s.True(ok)
}

func (s *ServicesSuite) TestPathsService_isSymlink_False_FileFound() {
	f, err := os.CreateTemp("", "file")
	if err != nil {
		s.Nil(err)
	}
	defer f.Close()
	defer os.Remove(f.Name())

	afs := afero.NewOsFs()

	fpath := util.NewPath(f.Name(), afs)
	lpath := util.NewPath(f.Name(), afs)

	ps := PathsService{fpath, afs, s.log}
	ok, err := ps.isSymlink(lpath)
	s.Nil(err)
	s.False(ok)
}

func (s *ServicesSuite) TestPathsService_isSymlink_False_FileMissing() {
	f, err := os.CreateTemp("", "file")
	if err != nil {
		s.Nil(err)
	}
	f.Close()
	os.Remove(f.Name())

	afs := afero.NewOsFs()

	fpath := util.NewPath(f.Name(), afs)
	lpath := util.NewPath("Not Found", afs)

	ps := PathsService{fpath, afs, s.log}
	ok, err := ps.isSymlink(lpath)
	s.Nil(err)
	s.False(ok)
}

type isTrustedTest struct {
	path string // the target pathname
	exp  bool   // the expected result
}

var isTrustedTests = []isTrustedTest{
	// cwd
	{".", true},

	// pwd
	{"..", false},

	// file
	{"file", true},
	{"./file", true},
	{"../file", false},

	// dir
	{"dir/", true},
	{"./dir/", true},
	{"../dir/", false},
	{"./dir/../", true},
	{"./dir/../../", false},
}

func (s *ServicesSuite) TestPathsService_isTrusted() {
	for _, t := range isTrustedTests {
		afs := afero.NewMemMapFs()

		fpath := util.NewPath("", afs)
		tpath := util.NewPath(t.path, afs)

		ps := PathsService{fpath, afs, s.log}
		res, _ := ps.isTrusted(tpath)
		s.Equalf(t.exp, res, "%s should be %t, found %t", t.path, t.exp, res)
	}
}
