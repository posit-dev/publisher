package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"testing"

	"github.com/rstudio/publishing-client/internal/logging"
	"github.com/rstudio/publishing-client/internal/util/utiltest"
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
	log := logging.New()
	fs := utiltest.NewMockFs()
	accountList := NewAccountList(fs, log)
	s.Len(accountList.providers, 3)
	s.Equal(log, accountList.log)
}

func (s *AccountListSuite) TestGetAllAccounts() {
	log := logging.New()
	accountList := defaultAccountList{
		providers: []AccountProvider{&s.provider1, &s.emptyProvider, &s.provider2},
		log:       log,
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
	log := logging.New()

	accountList := defaultAccountList{
		providers: []AccountProvider{&s.provider1, &s.erringProvider},
		log:       log,
	}
	allAccounts, err := accountList.GetAllAccounts()
	s.Nil(allAccounts)
	s.ErrorIs(err, s.testError)
}

func (s *AccountListSuite) TestGetAccountByName() {
	log := logging.New()
	accountList := defaultAccountList{
		providers: []AccountProvider{&s.emptyProvider, &s.provider1},
		log:       log,
	}
	account, err := accountList.GetAccountByName("myAcct")
	s.Nil(err)
	s.Equal("myAcct", account.Name)
}

func (s *AccountListSuite) TestGetAccountByNameErr() {
	log := logging.New()
	accountList := defaultAccountList{
		providers: []AccountProvider{&s.erringProvider},
		log:       log,
	}
	account, err := accountList.GetAccountByName("myAcct")
	s.ErrorIs(err, s.testError)
	s.Nil(account)
}

func (s *AccountListSuite) TestGetAccountByNameNotFound() {
	log := logging.New()
	accountList := defaultAccountList{
		providers: []AccountProvider{},
		log:       log,
	}
	account, err := accountList.GetAccountByName("myAcct")
	s.ErrorContains(err, "there is no account named 'myAcct'")
	s.Nil(account)
}

func (s *AccountListSuite) TestGetAccountsByServerType() {
	log := logging.New()

	account := Account{Name: "name", ServerType: ServerTypeConnect}
	accounts := []Account{account}
	provider := new(MockAccountProvider)
	provider.On("Load").Return(accounts, nil)

	providers := []AccountProvider{provider}

	accountList := defaultAccountList{
		providers: providers,
		log:       log,
	}

	res, err := accountList.GetAccountsByServerType(ServerTypeConnect)
	s.Nil(err)
	s.Equal(account, res[0])
}

func (s *AccountListSuite) TestGetAccountsByServerType_Empty() {
	log := logging.New()

	account := Account{Name: "name", ServerType: ServerTypeConnect}
	accounts := []Account{account}
	provider := new(MockAccountProvider)
	provider.On("Load").Return(accounts, nil)

	providers := []AccountProvider{provider}

	accountList := defaultAccountList{
		providers: providers,
		log:       log,
	}

	res, err := accountList.GetAccountsByServerType(ServerTypeCloud)
	s.Nil(err)
	s.Empty(res)
}
