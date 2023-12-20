package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/bundles/gitignore"
	"github.com/rstudio/connect-client/internal/services/api/files"
	"github.com/rstudio/connect-client/internal/services/api/paths"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/stretchr/testify/mock"
)

type MockFilesService struct {
	mock.Mock
	files.FilesService
}

func (m *MockFilesService) GetFile(p util.Path, ignore gitignore.IgnoreList) (*files.File, error) {
	args := m.Called(p, ignore)
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
