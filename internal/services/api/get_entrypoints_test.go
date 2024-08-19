package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type GetEntrypointsSuite struct {
	utiltest.Suite
	log logging.Logger
	cwd util.AbsolutePath
}

func TestGetEntrypointsSuite(t *testing.T) {
	suite.Run(t, new(GetEntrypointsSuite))
}

func (s *GetEntrypointsSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *GetEntrypointsSuite) SetupTest() {
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
}

func (s *GetEntrypointsSuite) makeFile(path util.AbsolutePath) {
	err := path.Dir().MkdirAll(0700)
	s.NoError(err)
	err = path.WriteFile(nil, 0600)
	s.NoError(err)
}

func (s *GetEntrypointsSuite) TestGetEntrypoints() {
	base := s.cwd.Join("subdir", "subsubdir")
	err := base.MkdirAll(0700)
	s.NoError(err)

	goodFiles := []string{
		filepath.Join("_site", "index.html"),
		"app.R",
		"app.py",
		"app2.r",
		"index.QMD",
		"index.htm",
		"index.html",
		"index.qmd",
		"notebook.ipynb",
		"plumber.R",
		"report.Rmd",
		"report2ju.rmd",
		"streamlit_app.py",
	}
	badFiles := []string{
		"something.txt",
		"whatever",
		filepath.Join("renv", "activate.R"),
		filepath.Join("_site", "somepage.html"),
		filepath.Join("report_files", "index.html"),
	}
	for _, f := range goodFiles {
		s.makeFile(base.Join(f))
	}
	for _, f := range badFiles {
		s.makeFile(base.Join(f))
	}

	h := GetEntrypointsHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/entrypoints", nil)
	s.NoError(err)
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := []string{}
	dec := json.NewDecoder(rec.Body)
	s.NoError(dec.Decode(&res))

	expected := util.Map(func(f string) string {
		return filepath.Join("subdir", "subsubdir", f)
	}, goodFiles)
	s.Equal(expected, res)
}
