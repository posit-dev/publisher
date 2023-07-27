package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type FilesSuite struct {
	utiltest.Suite
}

func TestFilesSuite(t *testing.T) {
	suite.Run(t, new(FilesSuite))
}

func (s *FilesSuite) TestToFiles() {
	fs := afero.NewOsFs()
	pathname := "."
	files, err := ToFile(fs, pathname)
	s.NotNil(files)
	s.NoError(err)
	s.Equal(files.Pathname, pathname)
}

func (s *FilesSuite) TestNewFilesController() {
	req, err := http.NewRequest("GET", "", nil)
	s.NoError(err)
	fs := afero.NewMemMapFs()
	log := rslog.NewDiscardingLogger()
	rec := httptest.NewRecorder()
	GetFile(fs, log, rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/hal+json", rec.Header().Get("content-type"))

	res := &File{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(res))

	s.Equal(".", res.Pathname)
}

func (s *FilesSuite) TestNewFilesController_Pathname() {
	fs := afero.NewMemMapFs()
	pathname, _ := afero.TempDir(fs, "", "")
	req, err := http.NewRequest("GET", "?pathname="+pathname, nil)
	s.NoError(err)

	log := rslog.NewDiscardingLogger()
	rec := httptest.NewRecorder()
	GetFile(fs, log, rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/hal+json", rec.Header().Get("content-type"))

	res := &File{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(res))

	s.Equal(pathname, res.Pathname)
}
