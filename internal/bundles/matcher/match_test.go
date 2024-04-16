package matcher

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

type MatchSuite struct {
	utiltest.Suite
	cwd util.AbsolutePath
}

func TestMatchSuite(t *testing.T) {
	suite.Run(t, new(MatchSuite))
}

func (s *MatchSuite) SetupTest() {
	path := "/project"
	if runtime.GOOS == "windows" {
		path = `C:\project`
	}
	s.cwd = util.NewAbsolutePath(path, afero.NewMemMapFs())
}

type testCase struct {
	pattern  string
	path     string
	matches  bool
	inverted bool
}

func (s *MatchSuite) TestFiles() {
	s.runTestCases(fileTestCases)
}

func (s *MatchSuite) TestDirectories() {
	s.runTestCases(dirTestCases)
}

func (s *MatchSuite) TestInverted() {
	s.runTestCases(invertedTestCases)
}

func (s *MatchSuite) TestSpecialLines() {
	s.runTestCases(specialLineTestCases)
}

func (s *MatchSuite) TestSpecialChars() {
	if runtime.GOOS == "windows" {
		s.T().SkipNow()
	}
	// Don't name your direrctories like this!
	// But we'll handle it if you do.
	s.cwd = util.NewAbsolutePath(`/.+\|{}()<>^$:[]?*`, afero.NewMemMapFs())
	s.runTestCases(specialCharTestCases)
}

func (s *MatchSuite) TestSpecialCharsWindows() {
	if runtime.GOOS != "windows" {
		s.T().SkipNow()
	}
	s.cwd = util.NewAbsolutePath(`C:\.+\|{}()<>^$:[]?*`, afero.NewMemMapFs())
	s.runTestCases(windowsSpecialCharTestCases)
}

func (s *MatchSuite) runTestCases(cases []testCase) {
	for _, test := range cases {
		matchList, err := NewMatchList(s.cwd, strings.Split(test.pattern, "\n"))
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

		m := matchList.Match(absPath)

		if test.matches {
			s.NotNil(m, "pattern %s should have matched path %s (%s)", test.pattern, test.path, absPath)

			if test.inverted {
				s.True(m.Exclude, "pattern match should have been inverted: %s with %s (%s)", test.pattern, test.path, absPath)
			} else {
				s.False(m.Exclude, "pattern match should not have been inverted: %s with %s (%s)", test.pattern, test.path, absPath)
			}
		} else {
			s.Nil(m, "pattern %s should not have matched path %s (%s)", test.pattern, test.path, absPath)
		}
	}
}

var fileTestCases = []testCase{
	{"app.py", "app.py", true, false},
	{"app.py", "dir/app.py", true, false},
	{"app.py", "dir/subdir/app.py", true, false},
	{"app.py", "foo.py", false, false},

	{"/app.py", "app.py", true, false},
	{"/app.py", "dir/app.py", false, false},
	{"/app.py", "dir/subdir/app.py", false, false},

	{"*.py", "app.py", true, false},
	{"*.py", "dir/app.py", true, false},
	{"*.py", "dir/subdir/app.py", true, false},
	{"*.py", "foo.py", true, false},
	{"*.py", "app.json", false, false},

	{"*", "app.py", true, false},
	{"*", "dir/app.py", true, false},
	{"*", "dir/subdir/app.py", true, false},
	{"*", "foo.py", true, false},

	{"dir/app.py", "dir/app.py", true, false},
	{"dir/app.py", "app.py", false, false},
	{"dir/app.py", "dir/subdir/app.py", false, false},
	{"dir/app.py", "subdir/dir/app.py", false, false},
	{"dir/app.py", "dir/foo.py", false, false},
	{"dir/app.py", "dir/app.json", false, false},

	{"dir/*.py", "dir/app.py", true, false},
	{"dir/*.py", "app.py", false, false},
	{"dir/*.py", "dir/subdir/app.py", false, false},
	{"dir/*.py", "subdir/dir/app.py", false, false},
	{"dir/*.py", "dir/foo.py", true, false},
	{"dir/*.py", "dir/app.json", false, false},

	{"**/app.py", "dir/app.py", true, false},
	{"**/app.py", "app.py", true, false},
	{"**/app.py", "dir/subdir/app.py", true, false},
	{"**/app.py", "subdir/dir/app.py", true, false},
	{"**/app.py", "dir/foo.py", false, false},
	{"**/app.py", "dir/app.json", false, false},

	{"**/*.py", "dir/app.py", true, false},
	{"**/*.py", "app.py", true, false},
	{"**/*.py", "dir/subdir/app.py", true, false},
	{"**/*.py", "subdir/dir/app.py", true, false},
	{"**/*.py", "dir/foo.py", true, false},
	{"**/*.py", "dir/app.json", false, false},

	{"dir/**/app.py", "dir/app.py", true, false},
	{"dir/**/app.py", "app.py", false, false},
	{"dir/**/app.py", "dir/subdir/app.py", true, false},
	{"dir/**/app.py", "subdir/dir/app.py", false, false},
	{"dir/**/app.py", "dir/foo.py", false, false},
	{"dir/**/app.py", "dir/app.json", false, false},

	{"dir/**/*.py", "dir/app.py", true, false},
	{"dir/**/*.py", "app.py", false, false},
	{"dir/**/*.py", "dir/subdir/app.py", true, false},
	{"dir/**/*.py", "subdir/dir/app.py", false, false},
	{"dir/**/*.py", "dir/app.json", false, false},

	{"**/dir/app.py", "dir/app.py", true, false},
	{"**/dir/app.py", "app.py", false, false},
	{"**/dir/app.py", "dir/subdir/app.py", false, false},
	{"**/dir/app.py", "subdir/dir/app.py", true, false},
	{"**/dir/app.py", "dir/foo.py", false, false},
	{"**/dir/app.py", "dir/app.json", false, false},

	{"**/dir/*.py", "dir/app.py", true, false},
	{"**/dir/*.py", "app.py", false, false},
	{"**/dir/*.py", "dir/subdir/app.py", false, false},
	{"**/dir/*.py", "subdir/dir/app.py", true, false},
	{"**/dir/*.py", "dir/app.json", false, false},
}

var dirTestCases = []testCase{
	{"dir/", "dir", false, false},
	{"dir/", "dir/", true, false},
	{"dir/", "dir/app.py", true, false},
	{"dir/", "dir/subdir/", true, false},
	{"dir/", "dir/subdir/app.py", true, false},
	{"dir/", "subdir/dir/", true, false},
	{"dir/", "subdir/dir/app.py", true, false},

	{"dir/", "foo/", false, false},
	{"dir/", "foo/app.py", false, false},
	{"dir/", "foo/subdir/", false, false},
	{"dir/", "foo/subdir/app.py", false, false},
	{"dir/", "subdir/foo/", false, false},
	{"dir/", "subdir/foo/app.py", false, false},

	{"/dir/", "dir/", true, false},
	{"/dir/", "dir/app.py", true, false},
	{"/dir/", "dir/subdir/", true, false},
	{"/dir/", "dir/subdir/app.py", true, false},
	{"/dir/", "subdir/dir/", false, false},
	{"/dir/", "subdir/dir/app.py", false, false},

	{"dir", "dir/", true, false},
	{"dir", "dir/app.py", true, false},
	{"dir", "dir/subdir/", true, false},
	{"dir", "dir/subdir/app.py", true, false},
	{"dir", "subdir/dir/", true, false},
	{"dir", "subdir/dir/app.py", true, false},

	// From the gitignore docs: exclude everything except directory foo/bar
	{"/*\n!/foo\n/foo/*\n!/foo/bar", "/a", true, false},
	{"/*\n!/foo\n/foo/*\n!/foo/bar", "/foo", true, false},
	{"/*\n!/foo\n/foo/*\n!/foo/bar", "/foo/a", true, false},
	{"/*\n!/foo\n/foo/*\n!/foo/bar", "/foo/bar", true, true},
}

var invertedTestCases = []testCase{
	{"app.py\n!app.py", "app.py", true, true},
	{"!app.py\napp.py", "app.py", true, false},
	{"*.py\n!app.py", "app.py", true, true},
	{"!*.py\napp.py", "app.py", true, false},
	{"app.py\n!*.py", "app.py", true, true},
	{"!app.py\n*.py", "app.py", true, false},
	{"**/a/b\n!b", "/subdir/a/b", true, true},
	{"**/a/b\n!/a", "/subdir/a/b", true, false},
	{"**/a/b\n!/**/a", "/subdir/a/b", true, true},
	{"app.py\n!app.py\napp.py", "app.py", true, false},
	{"app.py\napp.py\n!app.py", "app.py", true, true},
	{"!app.py\n!app.py\n*.py", "app.py", true, false},
	{"!app.py\n!*.py\n*.py", "app.py", true, false},
	{"!app.py\n!*.py\napp.py", "app.py", true, false},
}

var specialLineTestCases = []testCase{
	{"", "", false, false},
	{"#abc", "#abc", false, false},
	{"\\#abc", "#abc", true, false},
	{"abc\n!abc", "abc", true, true},
	{"abc\n\\!abc", "abc", true, false},
	{"!abc\n!abc", "!abc", false, false},
	{"!abc\n\\!abc", "!abc", true, false},
}

var specialCharTestCases = []testCase{
	{"untitled-1 (copy *)", "untitled-1 (copy 1)", true, false},
	{"abc.\\|+{}()<>^$:def", "abc.\\|+{}()<>^$:def", true, false},
	{"abc.\\|+{}()<>^$:def", "abcX\\|+{}()<>^$:def", false, false},
	{"abc.\\|+{}()<>^$:def", "abc.\\||||||{}()<>^$:def", false, false},
	{"abc.\\|+{}()<>^$:def*", "abc.\\|+{}()<>^$:defghi", true, false},
}

var windowsSpecialCharTestCases = []testCase{
	// No backslashes in path names
	{"untitled-1 (copy *)", "untitled-1 (copy 1)", true, false},
	{"abc.|+{}()<>^$:def", "abc.|+{}()<>^$:def", true, false},
	{"abc.|+{}()<>^$:def", "abcX|+{}()<>^$:def", false, false},
	{"abc.|+{}()<>^$:def", "abc.||||||{}()<>^$:def", false, false},
	{"abc.|+{}()<>^$:def*", "abc.|+{}()<>^$:defghi", true, false},
}
