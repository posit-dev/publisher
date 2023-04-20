package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type EntrypointSuite struct {
	utiltest.Suite
}

func TestEntrypointSuite(t *testing.T) {
	suite.Run(t, new(EntrypointSuite))
}

// func inferEntrypoint(fs afero.Fs, path string, suffix string, preferredFilename string) (string, error) {
func (s *EntrypointSuite) TestInferEntrypointSpecifiedFile() {
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, "app.py", []byte{}, 0600)
	s.Nil(err)

	entrypoint, err := inferEntrypoint(fs, "app.py", ".py", "app.py")
	s.Nil(err)
	s.Equal("app.py", entrypoint)
}

func (s *EntrypointSuite) TestInferEntrypointMatchingPreferredFileAndAnother() {
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, "app.py", []byte{}, 0600)
	s.Nil(err)
	err = afero.WriteFile(fs, "mylib.py", []byte{}, 0600)
	s.Nil(err)

	entrypoint, err := inferEntrypoint(fs, ".", ".py", "app.py")
	s.Nil(err)
	s.Equal("app.py", entrypoint)
}

func (s *EntrypointSuite) TestInferEntrypointNonMatchingFile() {
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, "app.py", []byte{}, 0600)
	s.Nil(err)

	entrypoint, err := inferEntrypoint(fs, "app.py", ".ipynb", "index.ipynb")
	s.Nil(err)
	s.Equal("", entrypoint)
}

func (s *EntrypointSuite) TestInferEntrypointOnlyMatchingFile() {
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, "myapp.py", []byte{}, 0600)
	s.Nil(err)

	entrypoint, err := inferEntrypoint(fs, ".", ".py", "app.py")
	s.Nil(err)
	s.Equal("myapp.py", entrypoint)
}

func (s *EntrypointSuite) TestInferEntrypointMultipleMatchingFiles() {
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, "myapp.py", []byte{}, 0600)
	s.Nil(err)
	err = afero.WriteFile(fs, "mylib.py", []byte{}, 0600)
	s.Nil(err)

	entrypoint, err := inferEntrypoint(fs, ".", ".py", "app.py")
	s.Nil(err)
	s.Equal("", entrypoint)
}
