package files

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"log/slog"

	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type ServicesSuite struct {
	utiltest.Suite
	log *slog.Logger
}

func TestServicesSuite(t *testing.T) {
	suite.Run(t, new(ServicesSuite))
}

func (s *ServicesSuite) SetupSuite() {
	s.log = slog.Default()
}

func (s *ServicesSuite) TestCreateFilesService() {
	afs := afero.NewMemMapFs()
	base := util.NewPath("", afs)
	service := CreateFilesService(base, afs, s.log)
	s.NotNil(service)
}

func (s *ServicesSuite) TestGetFile() {
	afs := afero.NewMemMapFs()
	base := util.NewPath("", afs)
	service := CreateFilesService(base, afs, s.log)
	s.NotNil(service)
	file, err := service.GetFile(base)
	s.Nil(err)
	s.NotNil(file)
}

func (s *ServicesSuite) TestGetFileUsingSampleContent() {
	afs := afero.NewOsFs()
	base := util.NewPath("../../../../test/sample-content/fastapi-simple", afs)
	service := CreateFilesService(base, afs, s.log)
	s.NotNil(service)
	file, err := service.GetFile(base)
	s.Nil(err)
	s.NotNil(file)
}

func (s *ServicesSuite) TestGetFileUsingSampleContentWithTrailingSlash() {
	afs := afero.NewOsFs()
	base := util.NewPath("../../../../test/sample-content/fastapi-simple/", afs)
	service := CreateFilesService(base, afs, s.log)
	s.NotNil(service)
	file, err := service.GetFile(base)
	s.Nil(err)
	s.NotNil(file)
}
