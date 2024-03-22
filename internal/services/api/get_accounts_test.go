package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type GetAccountsSuite struct {
	utiltest.Suite
	log logging.Logger
}

func TestGetAccountsSuite(t *testing.T) {
	suite.Run(t, new(GetAccountsSuite))
}

func (s *GetAccountsSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *GetAccountsSuite) TestGetAccounts() {
	lister := &accounts.MockAccountList{}
	lister.On("GetAccountsByServerType", accounts.ServerTypeConnect).Return([]accounts.Account{
		{
			Name:       "myAccount",
			ServerType: accounts.ServerTypeConnect,
		},
		{
			Name:       "otherAccount",
			ServerType: accounts.ServerTypeConnect,
		},
	}, nil)
	h := GetAccountsHandlerFunc(lister, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/accounts", nil)
	s.NoError(err)
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	accts := getAccountsResponse{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&accts))

	s.Len(accts, 2)
	s.Equal("myAccount", accts[0].Name)
	s.Equal(string(accounts.ServerTypeConnect), accts[0].Type)
	s.Equal("otherAccount", accts[1].Name)
	s.Equal(string(accounts.ServerTypeConnect), accts[1].Type)
}

func (s *GetAccountsSuite) TestGetAccountsError() {
	lister := &accounts.MockAccountList{}
	testError := errors.New("test error from GetAccountsByServerType")
	lister.On("GetAccountsByServerType", accounts.ServerTypeConnect).Return(nil, testError)
	h := GetAccountsHandlerFunc(lister, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/accounts", nil)
	s.NoError(err)
	h(rec, req)

	s.Equal(http.StatusInternalServerError, rec.Result().StatusCode)
}

func (s *GetAccountsSuite) TestGetAccountsNoAccounts() {
	lister := &accounts.MockAccountList{}
	lister.On("GetAccountsByServerType", accounts.ServerTypeConnect).Return(nil, nil)
	h := GetAccountsHandlerFunc(lister, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/accounts", nil)
	s.NoError(err)
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	accts := getAccountsResponse{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&accts))

	s.NotNil(accts)
	s.Len(accts, 0)
}
