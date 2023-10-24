package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/services/api/deployments"
	"github.com/rstudio/connect-client/internal/services/api/files"
	"github.com/rstudio/connect-client/internal/services/api/paths"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/stretchr/testify/mock"
)

type MockDeploymentsService struct {
	mock.Mock
	deployments.DeploymentsService
}

func (m *MockDeploymentsService) GetDeployment() *state.Deployment {
	args := m.Called()
	return args.Get(0).(*state.Deployment)
}

func (m *MockDeploymentsService) SetDeploymentFiles(files []string) *state.Deployment {
	args := m.Called()
	return args.Get(0).(*state.Deployment)
}

func (m *MockDeploymentsService) SetDeploymentAccount(lister accounts.AccountList, account_name string) (*state.Deployment, error) {
	args := m.Called()
	return args.Get(0).(*state.Deployment), nil
}

type MockFilesService struct {
	mock.Mock
	files.FilesService
}

func (m *MockFilesService) GetFile(p util.Path) (*files.File, error) {
	args := m.Called(p)
	return args.Get(0).(*files.File), args.Error(1)
}

type MockPathsService struct {
	mock.Mock
	paths.PathsService
}

func (m *MockPathsService) IsSafe(p util.Path) (bool, error) {
	args := m.Called(p)
	return args.Bool(0), args.Error(1)
}
