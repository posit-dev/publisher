package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/stretchr/testify/suite"
)

type AccountListSuite struct {
	utiltest.Suite
	provider1      MockAccountProvider
	provider2      MockAccountProvider
	emptyProvider  MockAccountProvider
	erringProvider MockAccountProvider
	testError      error
}

func TestAccountListSuite(t *testing.T) {
	suite.Run(t, new(AccountListSuite))
}

func (s *AccountListSuite) SetupSuite() {
	s.provider1.On("Load").Return([]Account{
		{Name: "myAcct"},
		{Name: "yourAcct"},
	}, nil)
	s.provider2.On("Load").Return([]Account{
		{Name: "myOtherAcct"},
		{Name: "yourOtherAcct"},
	}, nil)
	s.emptyProvider.On("Load").Return(nil, nil)
	s.testError = errors.New("kaboom!")
	s.erringProvider.On("Load").Return(nil, s.testError)
}

func (s *AccountListSuite) TestNewAccountList() {
	logger := rslog.NewDiscardingLogger()
	fs := utiltest.NewMockFs()
	accountList := NewAccountList(fs, logger)
	s.Len(accountList.providers, 3)
	s.Equal(logger, accountList.logger)
}

func (s *AccountListSuite) TestGetAllAccounts() {
	logger := rslog.NewDiscardingLogger()
	accountList := defaultAccountList{
		providers: []AccountProvider{&s.provider1, &s.emptyProvider, &s.provider2},
		logger:    logger,
	}
	allAccounts, err := accountList.GetAllAccounts()
	s.Nil(err)
	s.Equal([]Account{
		{Name: "myAcct"},
		{Name: "yourAcct"},
		{Name: "myOtherAcct"},
		{Name: "yourOtherAcct"},
	}, allAccounts)
}

func (s *AccountListSuite) TestGetAllAccountsErr() {
	logger := rslog.NewDiscardingLogger()

	accountList := defaultAccountList{
		providers: []AccountProvider{&s.provider1, &s.erringProvider},
		logger:    logger,
	}
	allAccounts, err := accountList.GetAllAccounts()
	s.Nil(allAccounts)
	s.ErrorIs(err, s.testError)
}

func (s *AccountListSuite) TestGetAccountByName() {
	logger := rslog.NewDiscardingLogger()
	accountList := defaultAccountList{
		providers: []AccountProvider{&s.emptyProvider, &s.provider1},
		logger:    logger,
	}
	account, err := accountList.GetAccountByName("myAcct")
	s.Nil(err)
	s.Equal("myAcct", account.Name)
}

func (s *AccountListSuite) TestGetAccountByNameErr() {
	logger := rslog.NewDiscardingLogger()
	accountList := defaultAccountList{
		providers: []AccountProvider{&s.erringProvider},
		logger:    logger,
	}
	account, err := accountList.GetAccountByName("myAcct")
	s.ErrorIs(err, s.testError)
	s.Nil(account)
}

func (s *AccountListSuite) TestGetAccountByNameNotFound() {
	logger := rslog.NewDiscardingLogger()
	accountList := defaultAccountList{
		providers: []AccountProvider{},
		logger:    logger,
	}
	account, err := accountList.GetAccountByName("myAcct")
	s.ErrorContains(err, "There is no account named 'myAcct'")
	s.Nil(account)
}
