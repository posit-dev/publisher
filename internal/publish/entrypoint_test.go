package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"path/filepath"
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

func (s *EntrypointSuite) TestInferEntrypointSpecifiedFile() {
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, "app.py", []byte{}, 0600)
	s.Nil(err)

	h := defaultInferenceHelper{}
	entrypoint, entrypointPath, err := h.InferEntrypoint(fs, "app.py", ".py", "app.py")
	s.Nil(err)
	s.Equal("app.py", entrypoint)
	s.Equal("app.py", filepath.Base(entrypointPath))
}

func (s *EntrypointSuite) TestInferEntrypointMatchingPreferredFileAndAnother() {
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, "app.py", []byte{}, 0600)
	s.Nil(err)
	err = afero.WriteFile(fs, "mylib.py", []byte{}, 0600)
	s.Nil(err)

	h := defaultInferenceHelper{}
	entrypoint, entrypointPath, err := h.InferEntrypoint(fs, ".", ".py", "app.py")
	s.Nil(err)
	s.Equal("app.py", entrypoint)
	s.Equal("app.py", filepath.Base(entrypointPath))
}

func (s *EntrypointSuite) TestInferEntrypointNonMatchingFile() {
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, "app.py", []byte{}, 0600)
	s.Nil(err)

	h := defaultInferenceHelper{}
	entrypoint, entrypointPath, err := h.InferEntrypoint(fs, "app.py", ".ipynb", "index.ipynb")
	s.Nil(err)
	s.Equal("", entrypoint)
	s.Equal("", entrypointPath)
}

func (s *EntrypointSuite) TestInferEntrypointOnlyMatchingFile() {
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, "myapp.py", []byte{}, 0600)
	s.Nil(err)

	h := defaultInferenceHelper{}
	entrypoint, entrypointPath, err := h.InferEntrypoint(fs, ".", ".py", "app.py")
	s.Nil(err)
	s.Equal("myapp.py", entrypoint)
	s.Equal("myapp.py", filepath.Base(entrypointPath))
}

func (s *EntrypointSuite) TestInferEntrypointMultipleMatchingFiles() {
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, "myapp.py", []byte{}, 0600)
	s.Nil(err)
	err = afero.WriteFile(fs, "mylib.py", []byte{}, 0600)
	s.Nil(err)

	h := defaultInferenceHelper{}
	entrypoint, entrypointPath, err := h.InferEntrypoint(fs, ".", ".py", "app.py")
	s.Nil(err)
	s.Equal("", entrypoint)
	s.Equal("", entrypointPath)
}
