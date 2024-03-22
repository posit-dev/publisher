package newignore

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"strings"
	"testing"

	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type NewIgnoreSuite struct {
	utiltest.Suite
	cwd util.AbsolutePath
}

func TestNewIgnoreSuite(t *testing.T) {
	suite.Run(t, new(NewIgnoreSuite))
}

func (s *NewIgnoreSuite) SetupTest() {
	s.cwd = util.NewAbsolutePath("/project", afero.NewMemMapFs())
}

type testCase struct {
	pattern string
	path    string
	matches bool
}

var fileTestCases = []testCase{
	{"app.py", "app.py", true},
	{"app.py", "dir/app.py", true},
	{"app.py", "dir/subdir/app.py", true},
	{"app.py", "foo.py", false},

	{"/app.py", "app.py", true},
	{"/app.py", "dir/app.py", false},
	{"/app.py", "dir/subdir/app.py", false},

	{"*.py", "app.py", true},
	{"*.py", "dir/app.py", true},
	{"*.py", "dir/subdir/app.py", true},
	{"*.py", "foo.py", true},
	{"*.py", "app.json", false},

	{"dir/app.py", "dir/app.py", true},
	{"dir/app.py", "app.py", false},
	{"dir/app.py", "dir/subdir/app.py", false},
	{"dir/app.py", "subdir/dir/app.py", false},
	{"dir/app.py", "dir/foo.py", false},
	{"dir/app.py", "dir/app.json", false},

	{"dir/*.py", "dir/app.py", true},
	{"dir/*.py", "app.py", false},
	{"dir/*.py", "dir/subdir/app.py", false},
	{"dir/*.py", "subdir/dir/app.py", false},
	{"dir/*.py", "dir/foo.py", true},
	{"dir/*.py", "dir/app.json", false},

	{"**/app.py", "dir/app.py", true},
	{"**/app.py", "app.py", true},
	{"**/app.py", "dir/subdir/app.py", true},
	{"**/app.py", "subdir/dir/app.py", true},
	{"**/app.py", "dir/foo.py", false},
	{"**/app.py", "dir/app.json", false},

	{"**/*.py", "dir/app.py", true},
	{"**/*.py", "app.py", true},
	{"**/*.py", "dir/subdir/app.py", true},
	{"**/*.py", "subdir/dir/app.py", true},
	{"**/*.py", "dir/foo.py", true},
	{"**/*.py", "dir/app.json", false},

	{"dir/**/app.py", "dir/app.py", true},
	{"dir/**/app.py", "app.py", false},
	{"dir/**/app.py", "dir/subdir/app.py", true},
	{"dir/**/app.py", "subdir/dir/app.py", false},
	{"dir/**/app.py", "dir/foo.py", false},
	{"dir/**/app.py", "dir/app.json", false},

	{"dir/**/*.py", "dir/app.py", true},
	{"dir/**/*.py", "app.py", false},
	{"dir/**/*.py", "dir/subdir/app.py", true},
	{"dir/**/*.py", "subdir/dir/app.py", false},
	{"dir/**/*.py", "dir/app.json", false},

	{"**/dir/app.py", "dir/app.py", true},
	{"**/dir/app.py", "app.py", false},
	{"**/dir/app.py", "dir/subdir/app.py", false},
	{"**/dir/app.py", "subdir/dir/app.py", true},
	{"**/dir/app.py", "dir/foo.py", false},
	{"**/dir/app.py", "dir/app.json", false},

	{"**/dir/*.py", "dir/app.py", true},
	{"**/dir/*.py", "app.py", false},
	{"**/dir/*.py", "dir/subdir/app.py", false},
	{"**/dir/*.py", "subdir/dir/app.py", true},
	{"**/dir/*.py", "dir/app.json", false},
}

func (s *NewIgnoreSuite) TestMatch() {
	for _, test := range fileTestCases {
		ign := NewIgnoreList([]string{})
		ignorePath := s.cwd.Join(".positignore")

		err := ignorePath.WriteFile([]byte(test.pattern), 0600)
		s.NoError(err)

		err = ign.AddFile(ignorePath)
		s.NoError(err)

		absPath := s.cwd.Join(test.path)
		m := ign.Match(absPath)

		if test.matches {
			s.NotNil(m, "pattern %s should have matched path %s", test.pattern, test.path)
		} else {
			s.Nil(m, "pattern %s should not have matched path %s", test.pattern, test.path)
		}
	}
}

var dirTestCases = []testCase{
	{"dir/", "dir", false},
	{"dir/", "dir/", true},
	{"dir/", "dir/app.py", true},
	{"dir/", "dir/subdir/", true},
	{"dir/", "dir/subdir/app.py", true},
	{"dir/", "subdir/dir/", true},
	{"dir/", "subdir/dir/app.py", true},

	{"dir/", "foo/", false},
	{"dir/", "foo/app.py", false},
	{"dir/", "foo/subdir/", false},
	{"dir/", "foo/subdir/app.py", false},
	{"dir/", "subdir/foo/", false},
	{"dir/", "subdir/foo/app.py", false},

	{"/dir/", "dir/", true},
	{"/dir/", "dir/app.py", true},
	{"/dir/", "dir/subdir/", true},
	{"/dir/", "dir/subdir/app.py", true},
	{"/dir/", "subdir/dir/", false},
	{"/dir/", "subdir/dir/app.py", false},

	{"dir", "dir/", true},
	{"dir", "dir/app.py", true},
	{"dir", "dir/subdir/", true},
	{"dir", "dir/subdir/app.py", true},
	{"dir", "subdir/dir/", true},
	{"dir", "subdir/dir/app.py", true},
}

func (s *NewIgnoreSuite) TestMatchDir() {
	for _, test := range dirTestCases {
		ign := NewIgnoreList([]string{})
		ignorePath := s.cwd.Join(".positignore")

		err := ignorePath.WriteFile([]byte(test.pattern), 0600)
		s.NoError(err)

		err = ign.AddFile(ignorePath)
		s.NoError(err)

		absPath := s.cwd.Join(test.path)

		if strings.HasSuffix(test.path, "/") {
			// If a directory path, create it
			err = absPath.MkdirAll(0777)
			s.NoError(err)
		} else {
			// If a file path, create the parent directory
			err = absPath.Dir().MkdirAll(0777)
			s.NoError(err)
		}

		m := ign.Match(absPath)

		if test.matches {
			s.NotNil(m, "pattern %s should have matched path %s", test.pattern, test.path)
		} else {
			s.Nil(m, "pattern %s should not have matched path %s", test.pattern, test.path)
		}
	}
}
