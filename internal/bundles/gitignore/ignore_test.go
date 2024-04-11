package gitignore

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"path/filepath"
	"runtime"
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
	path := "/project"
	if runtime.GOOS == "windows" {
		path = `C:\project`
	}
	s.cwd = util.NewAbsolutePath(path, afero.NewMemMapFs())
}

type testCase struct {
	pattern string
	path    string
	matches bool
}

func (s *NewIgnoreSuite) TestFiles() {
	s.runTestCases(fileTestCases)
}

func (s *NewIgnoreSuite) TestDirectories() {
	s.runTestCases(dirTestCases)
}

func (s *NewIgnoreSuite) TestInverted() {
	s.runTestCases(invertedTestCases)
}

func (s *NewIgnoreSuite) TestSpecialLines() {
	s.runTestCases(specialLineTestCases)
}

func (s *NewIgnoreSuite) TestSpecialChars() {
	if runtime.GOOS == "windows" {
		s.T().SkipNow()
	}
	// Don't name your direrctories like this!
	// But we'll handle it if you do.
	s.cwd = util.NewAbsolutePath(`/.\|+{}()<>^$:[]?*`, afero.NewMemMapFs())
	s.runTestCases(specialCharTestCases)
}

func (s *NewIgnoreSuite) TestSpecialCharsWindows() {
	if runtime.GOOS != "windows" {
		s.T().SkipNow()
	}
	s.cwd = util.NewAbsolutePath(`C:\.\|+{}()<>^$:[]?*`, afero.NewMemMapFs())
	s.runTestCases(windowsSpecialCharTestCases)
}

func (s *NewIgnoreSuite) runTestCases(cases []testCase) {
	for _, test := range cases {
		ign, err := NewIgnoreList(s.cwd, strings.Split(test.pattern, "\n"))
		s.NoError(err)

		absPath := s.cwd.Join(filepath.FromSlash(test.path))

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
			s.NotNil(m, "pattern %s should have matched path %s (%s)", test.pattern, test.path, absPath)
		} else {
			s.Nil(m, "pattern %s should not have matched path %s (%s)", test.pattern, test.path, absPath)
		}
	}
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

	// From the gitignore docs: exclude everything except directory foo/bar
	{"/*\n!/foo\n/foo/*\n!/foo/bar", "/a", true},
	{"/*\n!/foo\n/foo/*\n!/foo/bar", "/foo", true},
	{"/*\n!/foo\n/foo/*\n!/foo/bar", "/foo/a", true},
	{"/*\n!/foo\n/foo/*\n!/foo/bar", "/foo/bar", false},
}

var invertedTestCases = []testCase{
	{"app.py\n!app.py", "app.py", false},
	{"!app.py\napp.py", "app.py", true},
	{"*.py\n!app.py", "app.py", false},
	{"!*.py\napp.py", "app.py", true},
	{"app.py\n!*.py", "app.py", false},
	{"!app.py\n*.py", "app.py", true},
	{"**/a/b\n!b", "/subdir/a/b", false},
	{"**/a/b\n!/a", "/subdir/a/b", true},
	{"**/a/b\n!/**/a", "/subdir/a/b", false},
	{"app.py\n!app.py\napp.py", "app.py", true},
	{"app.py\napp.py\n!app.py", "app.py", false},
	{"!app.py\n!app.py\n*.py", "app.py", true},
	{"!app.py\n!*.py\n*.py", "app.py", true},
	{"!app.py\n!*.py\napp.py", "app.py", true},
}

var specialLineTestCases = []testCase{
	{"", "", false},
	{"#abc", "#abc", false},
	{"\\#abc", "#abc", true},
	{"abc\n!abc", "abc", false},
	{"abc\n\\!abc", "abc", true},
	{"!abc\n!abc", "!abc", false},
	{"!abc\n\\!abc", "!abc", true},
}

var specialCharTestCases = []testCase{
	{"untitled-1 (copy *)", "untitled-1 (copy 1)", true},
	{"abc.\\|+{}()<>^$:def", "abc.\\|+{}()<>^$:def", true},
	{"abc.\\|+{}()<>^$:def", "abcX\\|+{}()<>^$:def", false},
	{"abc.\\|+{}()<>^$:def", "abc.\\||||||{}()<>^$:def", false},
	{"abc.\\|+{}()<>^$:def*", "abc.\\|+{}()<>^$:defghi", true},
}

var windowsSpecialCharTestCases = []testCase{
	// No backslashes in path names
	{"untitled-1 (copy *)", "untitled-1 (copy 1)", true},
	{"abc.|+{}()<>^$:def", "abc.|+{}()<>^$:def", true},
	{"abc.|+{}()<>^$:def", "abcX|+{}()<>^$:def", false},
	{"abc.|+{}()<>^$:def", "abc.||||||{}()<>^$:def", false},
	{"abc.|+{}()<>^$:def*", "abc.|+{}()<>^$:defghi", true},
}
