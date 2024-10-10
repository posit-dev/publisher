package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/services/api/files"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
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

func (s *GetConfigFilesHandlerFuncSuite) TestHandlerFuncConfigUnknownFields() {
	// Mocking implementation config.FromFile
	configFromFile = func(path util.AbsolutePath) (*config.Config, error) {
		return nil, &types.AgentError{
			Message: "Unknown field present in configuration file",
			Code:    types.ErrorUnknownTOMLKey,
			Err:     errors.New("unknown field error"),
			Data: types.ErrorData{
				"file":   "/project-a/configuration-avcd.toml",
				"line":   3,
				"column": 1,
				"key":    "shortcut",
			},
		}
	}

	defer func() {
		// Be sure to revert config from file implementation
		configFromFile = config.FromFile
	}()

	afs := afero.NewMemMapFs()
	base, err := util.Getwd(afs)
	s.NoError(err)

	cfg := config.New()
	cfg.Type = config.ContentTypeHTML
	err = cfg.WriteFile(config.GetConfigPath(base, "myConfig"))
	s.NoError(err)

	filesService := new(MockFilesService)

	h := GetConfigFilesHandlerFunc(base, filesService, s.log)

	rec := httptest.NewRecorder()

	req, err := http.NewRequest("GET", "", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	h(rec, req)

	bodyRes := rec.Body.String()
	s.NoError(err)
	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
	s.Contains(bodyRes, `{"code":"unknownTOMLKey","details":{"filename":"/project-a/configuration-avcd.toml","line":3,"column":1,"key":"shortcut"}}`)
}

func (s *GetConfigFilesHandlerFuncSuite) TestHandlerFuncInvalidTOML() {
	// Mocking implementation config.FromFile
	configFromFile = func(path util.AbsolutePath) (*config.Config, error) {
		return nil, &types.AgentError{
			Message: "Bad Syntax",
			Code:    types.ErrorInvalidTOML,
			Err:     errors.New("unknown field error"),
			Data: types.ErrorData{
				"file":   "/project-a/configuration-avcd.toml",
				"line":   3,
				"column": 1,
			},
		}
	}

	defer func() {
		// Be sure to revert config from file implementation
		configFromFile = config.FromFile
	}()

	afs := afero.NewMemMapFs()
	base, err := util.Getwd(afs)
	s.NoError(err)

	cfg := config.New()
	cfg.Type = config.ContentTypeHTML
	err = cfg.WriteFile(config.GetConfigPath(base, "myConfig"))
	s.NoError(err)

	filesService := new(MockFilesService)

	h := GetConfigFilesHandlerFunc(base, filesService, s.log)

	rec := httptest.NewRecorder()

	req, err := http.NewRequest("GET", "", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	h(rec, req)

	bodyRes := rec.Body.String()
	s.NoError(err)
	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
	s.Contains(bodyRes, `{"code":"invalidTOML","details":{"filename":"/project-a/configuration-avcd.toml","line":3,"column":1}}`)
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

func (s *GetConfigFilesHandlerFuncSuite) TestHandlerFuncSubdir() {
	afs := afero.NewMemMapFs()
	projectDir, err := util.Getwd(afs)
	s.NoError(err)

	// We are requesting files from a project directory two levels down.
	base := projectDir.Dir().Dir()
	relProjectDir, err := projectDir.Rel(base)
	s.NoError(err)

	src := &files.File{Rel: "."}

	filesService := new(MockFilesService)
	filesService.On("GetFile", projectDir, mock.Anything).Return(src, nil)

	h := GetConfigFilesHandlerFunc(base, filesService, s.log)

	dirParam := url.QueryEscape(relProjectDir.String())
	rec := httptest.NewRecorder()

	cfg := config.New()
	cfg.Type = config.ContentTypeHTML
	cfg.Files = []string{"*", "!ignoreme"}
	err = cfg.WriteFile(config.GetConfigPath(projectDir, "myConfig"))
	s.NoError(err)

	req, err := http.NewRequest("GET", "/api/configurations/myConfig?dir="+dirParam, nil)
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

func (s *GetConfigFilesHandlerFuncSuite) TestHandlerFuncBadSubdir() {
	afs := afero.NewMemMapFs()
	projectDir, err := util.Getwd(afs)
	s.NoError(err)

	// We are requesting files from a project directory two levels down.
	base := projectDir.Dir().Dir()

	src := &files.File{Rel: "."}

	filesService := new(MockFilesService)
	filesService.On("GetFile", projectDir, mock.Anything).Return(src, nil)

	h := GetConfigFilesHandlerFunc(base, filesService, s.log)

	rec := httptest.NewRecorder()

	cfg := config.New()
	cfg.Type = config.ContentTypeHTML
	cfg.Files = []string{"*"}
	err = cfg.WriteFile(config.GetConfigPath(projectDir, "myConfig"))
	s.NoError(err)

	req, err := http.NewRequest("GET", "/api/configurations/myConfig?dir=../middleware", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	h(rec, req)

	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
}
