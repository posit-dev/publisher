package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type GetAccountSuite struct {
	utiltest.Suite
	log logging.Logger
}

func TestGetAccountSuite(t *testing.T) {
	suite.Run(t, new(GetAccountSuite))
}

func (s *GetAccountSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *GetAccountSuite) TestGetAccount() {
	lister := &accounts.MockAccountList{}
	lister.On("GetAccountByName", "myAccount").Return(&accounts.Account{
		Name:       "myAccount",
		ServerType: accounts.ServerTypeConnect,
	}, nil)
	h := GetAccountHandlerFunc(lister, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/account/myAccount", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myAccount"})
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := getAccountResponse{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))

	s.Equal("myAccount", res.Name)
	s.Equal(string(accounts.ServerTypeConnect), res.Type)
}

func (s *GetAccountSuite) TestGetAccountNotFound() {
	lister := &accounts.MockAccountList{}
	testError := fmt.Errorf("can't find account: %w", accounts.ErrAccountNotFound)
	lister.On("GetAccountByName", "myAccount").Return(nil, testError)
	h := GetAccountHandlerFunc(lister, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/account/myAccount", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myAccount"})
	h(rec, req)

	s.Equal(http.StatusNotFound, rec.Result().StatusCode)
}

func (s *GetAccountSuite) TestGetAccountErr() {
	lister := &accounts.MockAccountList{}
	testError := errors.New("test error from GetAccountByName")
	lister.On("GetAccountByName", "myAccount").Return(nil, testError)
	h := GetAccountHandlerFunc(lister, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/account/myAccount", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myAccount"})
	h(rec, req)

	s.Equal(http.StatusInternalServerError, rec.Result().StatusCode)
}
