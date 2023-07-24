package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type FilesSuite struct {
	utiltest.Suite
}

func TestFilesSuit(t *testing.T) {
	suite.Run(t, new(FilesSuite))
}

func (s *FilesSuite) TestGetFile() {
	files := GetFile("pathname")
	s.NotNil(files)
}

func (s *FilesSuite) TestNewFilesController() {
	req, err := http.NewRequest("GET", "", nil)
	s.NoError(err)

	rec := httptest.NewRecorder()
	controller := NewFilesController()
	controller(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/hal+json", rec.Header().Get("content-type"))

	exp := &File{Pathname: "."}
	res := &File{}
	json.Unmarshal(rec.Body.Bytes(), res)
	s.Equal(exp, res)
}

func (s *FilesSuite) TestNewFilesController_Pathname() {
	pathname, _ := os.Getwd()
	req, err := http.NewRequest("GET", "?pathname="+pathname, nil)
	s.NoError(err)

	rec := httptest.NewRecorder()
	controller := NewFilesController()
	controller(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/hal+json", rec.Header().Get("content-type"))

	exp := &File{Pathname: pathname}
	res := &File{}
	json.Unmarshal(rec.Body.Bytes(), res)
	s.Equal(exp, res)
}
