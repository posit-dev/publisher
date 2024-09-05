package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type PostInspectRemoteSuite struct {
	utiltest.Suite
	cwd util.AbsolutePath
}

func TestPostInspectRemoteSuite(t *testing.T) {
	suite.Run(t, new(PostInspectRemoteSuite))
}

func (s *PostInspectRemoteSuite) SetupTest() {
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
}

func (s *PostInspectRemoteSuite) TestPostInspectRemote() {
	lister := &accounts.MockAccountList{}
	acct := &accounts.Account{
		Name:       "myAccount",
		URL:        "https://connect.example.com",
		ServerType: accounts.ServerTypeConnect,
	}
	lister.On("GetAccountByName", "myAccount").Return(acct, nil)

	h := PostInspectRemoteHandlerFunc(s.cwd, logging.New(), lister)

	cfg := config.New()
	err := cfg.WriteFile(config.GetConfigPath(s.cwd, "myConfig"))
	s.NoError(err)

	rec := httptest.NewRecorder()
	body := strings.NewReader(`{
		"account": "myAccount"
	}`)
	guid := "abc"
	path, err := url.JoinPath("/api/inspect/remote/", guid)
	s.NoError(err)
	req, err := http.NewRequest("POST", path, body)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"guid": guid})
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := postInspectRemoteResponseBody{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))

	s.Equal(acct.URL, res.ServerURL)
	s.Equal(types.ContentID("abc"), res.ID)
	s.Equal(".", res.ProjectDir)
}
