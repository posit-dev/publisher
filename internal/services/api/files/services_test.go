package files

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/bundles/matcher"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type ServicesSuite struct {
	utiltest.Suite
	log logging.Logger
	cwd util.AbsolutePath
}

func TestServicesSuite(t *testing.T) {
	suite.Run(t, new(ServicesSuite))
}

func (s *ServicesSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *ServicesSuite) SetupTest() {
	// Create the current directory in a virtual FS
	// since the endpoint wants to cd into it.
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
}

func (s *ServicesSuite) TestCreateFilesService() {
	afs := afero.NewMemMapFs()
	base, err := util.Getwd(afs)
	s.NoError(err)

	service := CreateFilesService(base, s.log)
	s.NotNil(service)
}

func (s *ServicesSuite) TestGetFile() {
	base := s.cwd
	service := CreateFilesService(base, s.log)
	s.NotNil(service)
	ignore, err := matcher.NewIgnoreList(base, nil)
	s.NoError(err)

	file, err := service.GetFile(base, ignore)
	s.NoError(err)
	s.NotNil(file)
}

func (s *ServicesSuite) TestGetFileUsingSampleContent() {
	afs := afero.NewOsFs()
	base := s.cwd.Join("..", "..", "..", "..", "test", "sample-content", "fastapi-simple").WithFs(afs)

	service := CreateFilesService(base, s.log)
	s.NotNil(service)
	ignore, err := matcher.NewIgnoreList(base, nil)
	s.NoError(err)

	file, err := service.GetFile(base, ignore)
	s.NoError(err)
	s.NotNil(file)
}

func (s *ServicesSuite) TestGetFileUsingSampleContentWithTrailingSlash() {
	afs := afero.NewOsFs()
	base := s.cwd.Join("..", "..", "..", "..", "test", "sample-content", "fastapi-simple").WithFs(afs)

	service := CreateFilesService(base, s.log)
	s.NotNil(service)
	ignore, err := matcher.NewIgnoreList(base, nil)
	s.NoError(err)

	file, err := service.GetFile(base, ignore)
	s.NoError(err)
	s.NotNil(file)
}
