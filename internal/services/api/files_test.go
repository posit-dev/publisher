package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type FilesSuite struct {
	utiltest.Suite
	log rslog.Logger
}

func TestFilesSuite(t *testing.T) {
	suite.Run(t, new(FilesSuite))
}

func (s *FilesSuite) SetupSuite() {
	s.log = rslog.NewDiscardingLogger()
}

func (s *FilesSuite) TestToFile() {
	afs := afero.NewOsFs()
	pathname := "."
	path := util.NewPath(pathname, afs)
	files, err := toFile(path, path, s.log)
	s.NotNil(files)
	s.NoError(err)
	s.Equal(files.Pathname, pathname)
}

func (s *FilesSuite) TestGetFile() {
	req, err := http.NewRequest("GET", "", nil)
	s.NoError(err)
	afs := afero.NewMemMapFs()
	cwd := util.NewPath(".", afs)
	rec := httptest.NewRecorder()
	getFile(cwd, afs, s.log, rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := &file{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(res))

	s.Equal(".", res.Pathname)
}

func (s *FilesSuite) TestGetFile_WithPathname() {
	afs := afero.NewMemMapFs()
	cwd := util.NewPath(".", afs)
	pathname := "pathname"
	basename := filepath.Base(pathname)
	afs.Create(pathname)

	req, err := http.NewRequest("GET", "?pathname="+pathname, nil)
	s.NoError(err)

	rec := httptest.NewRecorder()
	getFile(cwd, afs, s.log, rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := &file{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(res))

	s.Equal(pathname, res.Pathname)
	s.Equal(basename, res.BaseName)
}
