package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/bundles/matcher"
	"github.com/posit-dev/publisher/internal/services/api/files"
	"github.com/posit-dev/publisher/internal/services/api/paths"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/stretchr/testify/mock"
)

type MockFilesService struct {
	mock.Mock
	files.FilesService
}

func (m *MockFilesService) GetFile(p util.AbsolutePath, matchList matcher.MatchList) (*files.File, error) {
	args := m.Called(p, matchList)
	return args.Get(0).(*files.File), args.Error(1)
}

type MockPathsService struct {
	mock.Mock
	paths.PathsService
}

func (m *MockPathsService) IsSafe(p util.AbsolutePath) (bool, error) {
	args := m.Called(p)
	return args.Bool(0), args.Error(1)
}
