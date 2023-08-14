package deployment

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
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
	log rslog.Logger
}

func TestFilesSuite(t *testing.T) {
	suite.Run(t, new(FilesSuite))
}

func (s *FilesSuite) SetupSuite() {
	s.log = rslog.NewDiscardingLogger()
}

func (s *FilesSuite) TestEndpoint() {
	var b body = body{
		Files: []string{
			"app.py",
			"requirements.txt",
		},
	}
	j, _ := json.Marshal(b)
	br := bytes.NewReader(j)
	req, err := http.NewRequest("PUT", "", br)

	s.NoError(err)
	d := state.NewDeployment()
	handler := NewFilesController(d, s.log)

	w := httptest.NewRecorder()
	handler(w, req)
	resp := w.Result()
	s.Equal(200, resp.StatusCode)

	decoder := json.NewDecoder(resp.Body)
	decoder.DisallowUnknownFields()
	err = decoder.Decode(d)
	s.NoError(err)

	res := d.Manifest.GetFilenames()
	s.Equal(b.Files, res)
}

func (s *FilesSuite) TestEndpointBadMethod() {
	req, err := http.NewRequest("DELETE", "", nil)
	s.NoError(err)
	d := state.NewDeployment()
	handler := NewFilesController(d, s.log)

	w := httptest.NewRecorder()
	handler(w, req)
	resp := w.Result()
	s.Equal(405, resp.StatusCode)
}

func (s *FilesSuite) TestEndpointInvalidBody() {
	body := strings.NewReader(`{
		"invalid": []
	}`)
	req, err := http.NewRequest("PUT", "", body)
	s.NoError(err)
	d := state.NewDeployment()
	handler := NewFilesController(d, s.log)

	w := httptest.NewRecorder()
	handler(w, req)
	resp := w.Result()
	s.Equal(400, resp.StatusCode)
}
