package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/services/api/files"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type GetConfigFilesHandlerFuncSuite struct {
	utiltest.Suite
	log logging.Logger
}

func TestGetConfigFilesHandlerFuncSuite(t *testing.T) {
	suite.Run(t, new(GetConfigFilesHandlerFuncSuite))
}

func (s *GetConfigFilesHandlerFuncSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *GetConfigFilesHandlerFuncSuite) TestGetConfigFilesHandlerFunc() {
	files := new(MockFilesService)
	files.On("GetFile", mock.Anything, mock.Anything).Return(nil, nil)

	afs := afero.NewMemMapFs()
	base, err := util.Getwd(afs)
	s.NoError(err)

	h := GetConfigFilesHandlerFunc(base, files, s.log)
	s.NotNil(h)
}

func (s *GetConfigFilesHandlerFuncSuite) TestHandlerFunc() {

	afs := afero.NewMemMapFs()
	base, err := util.Getwd(afs)
	s.NoError(err)

	src := &files.File{Rel: "."}

	filesService := new(MockFilesService)
	filesService.On("GetFile", mock.Anything, mock.Anything).Return(src, nil)

	h := GetConfigFilesHandlerFunc(base, filesService, s.log)

	rec := httptest.NewRecorder()

	cfg := config.New()
	cfg.Type = config.ContentTypeHTML
	cfg.Files = []string{"*", "!ignoreme"}
	err = cfg.WriteFile(config.GetConfigPath(base, "myConfig"))
	s.NoError(err)

	req, err := http.NewRequest("GET", "", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := &files.File{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(res))

	s.Equal(src.Rel, res.Rel)
	s.Equal(src.RelDir, res.RelDir)
}

func (s *GetConfigFilesHandlerFuncSuite) TestHandlerFuncGetFileReturnsError() {
	afs := afero.NewMemMapFs()
	base, err := util.Getwd(afs)
	s.NoError(err)

	src := &files.File{Rel: base.String()}

	cfg := config.New()
	cfg.Type = config.ContentTypeHTML
	cfg.Files = []string{"*", "!ignoreme"}
	err = cfg.WriteFile(config.GetConfigPath(base, "myConfig"))
	s.NoError(err)

	filesService := new(MockFilesService)
	filesService.On("GetFile", mock.Anything, mock.Anything).Return(src, errors.New(""))

	h := GetConfigFilesHandlerFunc(base, filesService, s.log)

	rec := httptest.NewRecorder()

	req, err := http.NewRequest("GET", "", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	h(rec, req)

	s.Equal(http.StatusInternalServerError, rec.Result().StatusCode)
}

func (s *GetConfigFilesHandlerFuncSuite) TestHandlerFuncConfigNotFound() {
	afs := afero.NewMemMapFs()
	base, err := util.Getwd(afs)
	s.NoError(err)

	filesService := new(MockFilesService)

	h := GetConfigFilesHandlerFunc(base, filesService, s.log)

	rec := httptest.NewRecorder()

	req, err := http.NewRequest("GET", "", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	h(rec, req)

	s.Equal(http.StatusNotFound, rec.Result().StatusCode)
}

func (s *GetConfigFilesHandlerFuncSuite) TestHandlerFuncInvalidConfigFiles() {
	afs := afero.NewMemMapFs()
	base, err := util.Getwd(afs)
	s.NoError(err)

	cfg := config.New()
	cfg.Type = config.ContentTypeHTML
	cfg.Files = []string{"[Z-"}
	err = cfg.WriteFile(config.GetConfigPath(base, "myConfig"))
	s.NoError(err)

	filesService := new(MockFilesService)

	h := GetConfigFilesHandlerFunc(base, filesService, s.log)

	rec := httptest.NewRecorder()

	req, err := http.NewRequest("GET", "", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	h(rec, req)

	s.Equal(http.StatusUnprocessableEntity, rec.Result().StatusCode)
}
