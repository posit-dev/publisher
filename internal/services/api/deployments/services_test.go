package deployments

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"testing"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/bundles"
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
	deployment := state.NewDeployment()
	service := CreateDeploymentsService(deployment)
	s.NotNil(service)
}

func (s *ServicesSuite) TestGetDeployment() {
	src := state.NewDeployment()
	service := CreateDeploymentsService(src)
	res := service.GetDeployment()
	s.Equal(src, res)
}

func (s *ServicesSuite) TestSetDeploymentFiles() {
	src := state.NewDeployment()
	s.Equal(src.Manifest.Files, bundles.ManifestFileMap(bundles.ManifestFileMap{}))

	service := CreateDeploymentsService(src)

	files := []string{"file"}
	res := service.SetDeploymentFiles(files)
	s.Equal(src, res)
	s.Equal(res.Manifest.Files, bundles.ManifestFileMap{"file": bundles.ManifestFile{Checksum: ""}})
}

func (s *ServicesSuite) TestSetDeploymentAccount() {
	src := state.NewDeployment()
	s.Equal(src.Target.AccountName, "")
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
	lister.On("GetAccountByName", "unknown").Return(&accounts.Account{}, errors.New("Account Not Found"))

	res, err := service.SetDeploymentAccount(lister, "test")
	s.Nil(err)

	s.Equal(res.Target.AccountName, result.Name)
	s.Equal(res.Target.ServerType, result.ServerType)
	s.Equal(res.Target.ServerURL, result.URL)

	_, err = service.SetDeploymentAccount(lister, "unknown")
	s.NotNil(err)
}
