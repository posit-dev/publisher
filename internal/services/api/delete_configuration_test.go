package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type DeleteConfigurationSuite struct {
	utiltest.Suite
	log logging.Logger
	cwd util.AbsolutePath
}

func TestDeleteConfigurationSuite(t *testing.T) {
	suite.Run(t, new(DeleteConfigurationSuite))
}

func (s *DeleteConfigurationSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *DeleteConfigurationSuite) SetupTest() {
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
}

func createSampleConfiguration(root util.AbsolutePath, name string) (*config.Config, error) {
	path := config.GetConfigPath(root, name)
	cfg := config.New()
	cfg.Type = config.ContentTypePythonDash
	cfg.Entrypoint = "app.py"
	return cfg, cfg.WriteFile(path)
}

func (s *DeleteConfigurationSuite) fileExists(path util.AbsolutePath) {
	exists, err := path.Exists()
	s.NoError(err)
	s.True(exists)
}

func (s *DeleteConfigurationSuite) fileDoesNotExist(path util.AbsolutePath) {
	exists, err := path.Exists()
	s.NoError(err)
	s.False(exists)
}

func (s *DeleteConfigurationSuite) TestDeleteConfiguration() {
	configToDelete := "myConfig"
	_, err := createSampleConfiguration(s.cwd, configToDelete)
	s.NoError(err)
	targetPath := config.GetConfigPath(s.cwd, configToDelete)
	s.fileExists(targetPath)

	_, err = createSampleConfiguration(s.cwd, "anotherConfig")
	s.NoError(err)
	otherPath := config.GetConfigPath(s.cwd, "anotherConfig")
	s.fileExists(otherPath)

	h := DeleteConfigurationHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("DELETE", "/api/configurations/"+configToDelete, nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": configToDelete})
	h(rec, req)

	s.Equal(http.StatusNoContent, rec.Result().StatusCode)
	s.fileDoesNotExist(targetPath)
	s.fileExists(otherPath)
}

func (s *DeleteConfigurationSuite) TestDeleteConfigurationNotFound() {
	h := DeleteConfigurationHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("DELETE", "/api/configurations/myConfigName", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfigName"})
	h(rec, req)

	s.Equal(http.StatusNotFound, rec.Result().StatusCode)
}
