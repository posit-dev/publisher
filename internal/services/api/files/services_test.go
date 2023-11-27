package files

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type ServicesSuite struct {
	utiltest.Suite
	log logging.Logger
}

func TestServicesSuite(t *testing.T) {
	suite.Run(t, new(ServicesSuite))
}

func (s *ServicesSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *ServicesSuite) TestCreateFilesService() {
	afs := afero.NewMemMapFs()
	base := util.NewPath("", afs)
	service := CreateFilesService(base, s.log)
	s.NotNil(service)
}

func (s *ServicesSuite) TestGetFile() {
	afs := afero.NewMemMapFs()
	base := util.NewPath("", afs)
	service := CreateFilesService(base, s.log)
	s.NotNil(service)
	file, err := service.GetFile(base)
	s.Nil(err)
	s.NotNil(file)
}

func (s *ServicesSuite) TestGetFileUsingSampleContent() {
	afs := afero.NewOsFs()
	base := util.NewPath("../../../../test/sample-content/fastapi-simple", afs)
	service := CreateFilesService(base, s.log)
	s.NotNil(service)
	file, err := service.GetFile(base)
	s.Nil(err)
	s.NotNil(file)
}

func (s *ServicesSuite) TestGetFileUsingSampleContentWithTrailingSlash() {
	afs := afero.NewOsFs()
	base := util.NewPath("../../../../test/sample-content/fastapi-simple/", afs)
	service := CreateFilesService(base, s.log)
	s.NotNil(service)
	file, err := service.GetFile(base)
	s.Nil(err)
	s.NotNil(file)
}
