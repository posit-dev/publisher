package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
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

func (s *DeleteConfigurationSuite) TestDeleteConfigurationFromSubdir() {
	base := s.cwd.Dir().Dir()
	configToDelete := "myConfig"

	// Create a config in the upper directory that should be left alone
	_, err := createSampleConfiguration(base, configToDelete)
	s.NoError(err)
	pathToPreserve := config.GetConfigPath(base, configToDelete)
	s.fileExists(pathToPreserve)

	// Create a config in the subdir that should be deleted
	_, err = createSampleConfiguration(s.cwd, configToDelete)
	s.NoError(err)
	targetPath := config.GetConfigPath(s.cwd, configToDelete)
	s.fileExists(targetPath)

	relProjectDir, err := s.cwd.Rel(base)
	s.NoError(err)

	h := DeleteConfigurationHandlerFunc(base, s.log)

	dirParam := url.QueryEscape(relProjectDir.String())
	apiUrl := fmt.Sprintf("/api/configurations/%s?dir=%s", configToDelete, dirParam)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("DELETE", apiUrl, nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{
		"name": configToDelete,
	})
	h(rec, req)

	s.Equal(http.StatusNoContent, rec.Result().StatusCode)
	s.fileDoesNotExist(targetPath)
	s.fileExists(pathToPreserve)
}
