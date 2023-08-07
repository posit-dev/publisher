package deployment

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/stretchr/testify/suite"
)

type FilesSuite struct {
	utiltest.Suite
}

func TestFilesSuite(t *testing.T) {
	suite.Run(t, new(FilesSuite))
}

func (s *FilesSuite) TestEndpoint() {
	reqBody := strings.NewReader(`{"files": ["app.py", "requirements.txt"]}`)
	req, err := http.NewRequest("PUT", "/api/deployment/files", reqBody)
	s.NoError(err)
	var deploymentState state.Deployment
	logger := rslog.NewDiscardingLogger()
	handler := NewSelectedFilesEndpoint(&deploymentState, logger)

	w := httptest.NewRecorder()
	handler(w, req)
	resp := w.Result()
	s.Equal(200, resp.StatusCode)

	decoder := json.NewDecoder(resp.Body)
	decoder.DisallowUnknownFields()
	err = decoder.Decode(&deploymentState)
	s.NoError(err)
	expectedFilenames := []string{
		"app.py",
		"requirements.txt",
	}
	s.Equal(expectedFilenames, deploymentState.Manifest.GetFilenames())
}

func (s *FilesSuite) TestEndpointBadMethod() {
	req, err := http.NewRequest("DELETE", "/api/deployment/files", nil)
	s.NoError(err)
	var deploymentState state.Deployment
	logger := rslog.NewDiscardingLogger()
	handler := NewSelectedFilesEndpoint(&deploymentState, logger)

	w := httptest.NewRecorder()
	handler(w, req)
	resp := w.Result()
	s.Equal(405, resp.StatusCode)
}

func (s *FilesSuite) TestEndpointInvalidBody() {
	body := strings.NewReader(`{"foo": ["app.py", "requirements.txt"]}`)
	req, err := http.NewRequest("PUT", "/api/deployment/files", body)
	s.NoError(err)
	var deploymentState state.Deployment
	logger := rslog.NewDiscardingLogger()
	handler := NewSelectedFilesEndpoint(&deploymentState, logger)

	w := httptest.NewRecorder()
	handler(w, req)
	resp := w.Result()
	s.Equal(400, resp.StatusCode)
}
