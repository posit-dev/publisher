package pathnames

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"
	"strings"
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type PathnamesSuite struct {
	utiltest.Suite
}

func TestPathnamesSuite(t *testing.T) {
	suite.Run(t, new(PathnamesSuite))
}

func (s *PathnamesSuite) TestIsSafe() {
	afs := afero.NewMemMapFs()
	afs.Create("pathname")
	p := Create("pathname", afs)
	ok, err := p.IsSafe()
	s.Nil(err)
	s.True(ok)
}


func (s *PathnamesSuite) TestClean() {
	sep := os.PathSeparator
	builder := strings.Builder{}
	builder.WriteString("pathname")
	builder.WriteString(string(sep))
	builder.WriteString(string(sep))
	builder.WriteString("pathname")

	afs := afero.NewMemMapFs()
	p := Create(builder.String(), afs)
	c := p.clean()
	e := Create("pathname/pathname", afs)
	s.Equal(e, c)
}

func (s *PathnamesSuite) TestIsSymlink_True() {
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
	p := Create(l.Name(), afs)
	ok, err := p.isSymlink()
	s.Nil(err)
	s.True(ok)
}

func (s *PathnamesSuite) TestIsSymlink_False_FileFound() {
	f, err := os.CreateTemp("", "file")
	if err != nil {
		s.Nil(err)
	}
	defer f.Close()
	defer os.Remove(f.Name())

	afs := afero.NewOsFs()
	p := Create(f.Name(), afs)
	ok, err := p.isSymlink()
	s.Nil(err)
	s.False(ok)
}

func (s *PathnamesSuite) TestIsSymlink_False_FileMissing() {
	f, err := os.CreateTemp("", "file")
	if err != nil {
		s.Nil(err)
	}
	f.Close()
	os.Remove(f.Name())

	afs := afero.NewOsFs()
	p := Create(f.Name(), afs)
	ok, err := p.isSymlink()
	s.Nil(err)
	s.False(ok)
}

type isTrustedTest struct {
	v string
	e bool
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

func (s *PathnamesSuite) TestIsTrusted() {
	for _, t := range isTrustedTests {
		p := Create(t.v, nil)
		r, _ := p.isTrusted()
		s.Equalf(t.e, r, "%s should be %t, found %t", t.v, t.e, r)
	}
}
