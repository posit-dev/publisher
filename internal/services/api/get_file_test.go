package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/services/api/files"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type GetFileHandlerFuncSuite struct {
	utiltest.Suite
	log events.Logger
}

func TestGetFileHandlerFuncSuite(t *testing.T) {
	suite.Run(t, new(GetFileHandlerFuncSuite))
}

func (s *GetFileHandlerFuncSuite) SetupSuite() {
	s.log = events.DefaultLogger()
}

func (s *GetFileHandlerFuncSuite) TestGetFileHandlerFunc() {
	files := new(MockFilesService)
	files.On("GetFile", mock.Anything).Return(nil, nil)

	paths := new(MockPathsService)
	paths.On("IsSafe", mock.Anything).Return(nil, nil)

	afs := afero.NewMemMapFs()
	base := util.NewPath("", afs)
	h := GetFileHandlerFunc(base, files, paths, s.log)
	s.NotNil(h)
}

func (s *GetFileHandlerFuncSuite) TestHandlerFunc() {

	afs := afero.NewMemMapFs()
	base := util.NewPath("", afs)
	src := &files.File{Rel: base.String()}

	filesService := new(MockFilesService)
	filesService.On("GetFile", mock.Anything).Return(src, nil)

	pathsService := new(MockPathsService)
	pathsService.On("IsSafe", mock.Anything).Return(true, nil)

	h := GetFileHandlerFunc(base, filesService, pathsService, s.log)

	rec := httptest.NewRecorder()

	req, err := http.NewRequest("GET", "", nil)
	s.NoError(err)

	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := &files.File{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(res))

	s.Equal(src.Rel, res.Rel)
}

func (s *GetFileHandlerFuncSuite) TestHandlerFuncUsingPathname() {
	afs := afero.NewMemMapFs()
	base := util.NewPath("", afs)

	pathname := "pathname"
	src := &files.File{Rel: pathname}

	filesService := new(MockFilesService)
	filesService.On("GetFile", mock.Anything).Return(src, nil)

	pathsService := new(MockPathsService)
	pathsService.On("IsSafe", mock.Anything).Return(true, nil)

	h := GetFileHandlerFunc(base, filesService, pathsService, s.log)

	rec := httptest.NewRecorder()

	req, err := http.NewRequest("GET", "?pathname="+pathname, nil)
	s.NoError(err)

	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := &files.File{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(res))

	s.Equal(src.Rel, res.Rel)
}

func (s *GetFileHandlerFuncSuite) TestHandlerFuncIsSafeReturnsError() {
	afs := afero.NewMemMapFs()
	base := util.NewPath("", afs)

	filesService := new(MockFilesService)

	pathsService := new(MockPathsService)
	pathsService.On("IsSafe", mock.Anything).Return(false, errors.New(""))

	h := GetFileHandlerFunc(base, filesService, pathsService, s.log)

	rec := httptest.NewRecorder()

	req, err := http.NewRequest("GET", "", nil)
	s.NoError(err)

	h(rec, req)

	s.Equal(http.StatusInternalServerError, rec.Result().StatusCode)
}

func (s *GetFileHandlerFuncSuite) TestHandlerFuncIsSafeReturnsFalse() {
	afs := afero.NewMemMapFs()
	base := util.NewPath("", afs)

	filesService := new(MockFilesService)

	pathsService := new(MockPathsService)
	pathsService.On("IsSafe", mock.Anything).Return(false, nil)

	h := GetFileHandlerFunc(base, filesService, pathsService, s.log)

	rec := httptest.NewRecorder()

	req, err := http.NewRequest("GET", "", nil)
	s.NoError(err)

	h(rec, req)

	s.Equal(http.StatusForbidden, rec.Result().StatusCode)
}

func (s *GetFileHandlerFuncSuite) TestHandlerFuncGetFileReturnsError() {
	afs := afero.NewMemMapFs()
	base := util.NewPath("", afs)
	src := &files.File{Rel: base.String()}

	filesService := new(MockFilesService)
	filesService.On("GetFile", mock.Anything).Return(src, errors.New(""))

	pathsService := new(MockPathsService)
	pathsService.On("IsSafe", mock.Anything).Return(true, nil)

	h := GetFileHandlerFunc(base, filesService, pathsService, s.log)

	rec := httptest.NewRecorder()

	req, err := http.NewRequest("GET", "", nil)
	s.NoError(err)

	h(rec, req)

	s.Equal(http.StatusInternalServerError, rec.Result().StatusCode)
}
