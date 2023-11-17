package deployments

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"testing"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/deployment"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type ServicesSuite struct {
	utiltest.Suite
}

func TestServicesSuite(t *testing.T) {
	suite.Run(t, new(ServicesSuite))
}

func (s *ServicesSuite) TestCreateDeploymentsService() {
	src := state.Empty()
	service := CreateDeploymentsService(src)
	s.NotNil(service)
}

func (s *ServicesSuite) TestGetDeployment() {
	src := state.Empty()
	service := CreateDeploymentsService(src)
	res := service.GetDeployment()
	s.Equal(state.OldDeploymentFromState(src), res)
}

func (s *ServicesSuite) TestSetDeploymentAccount() {
	src := state.Empty()
	src.Target = &deployment.Deployment{}
	s.Equal(src.Target.ServerType, accounts.ServerType(""))
	s.Equal(src.Target.ServerURL, "")

	service := CreateDeploymentsService(src)

	result := &accounts.Account{
		Name:       "test",
		ServerType: accounts.ServerTypeConnect,
		URL:        "https://test.com",
	}

	lister := accounts.NewMockAccountList()
	lister.On("GetAccountByName", "test").Return(result, nil)
	lister.On("GetAccountByName", "unknown").Return(nil, errors.New("Account Not Found"))

	res, err := service.SetDeploymentAccount(lister, "test")
	s.Nil(err)

	s.Equal(result.ServerType, res.Target.ServerType)
	s.Equal(result.URL, res.Target.ServerURL)

	_, err = service.SetDeploymentAccount(lister, "unknown")
	s.NotNil(err)
}
