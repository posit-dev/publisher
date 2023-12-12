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

func (s *ServicesSuite) TestGetFileWithPositIgnore() {
	afs := afero.NewMemMapFs()
	base, err := util.Getwd(afs)
	s.NoError(err)

	err = base.Join(".positignore").WriteFile([]byte("ignore*\n"), 0666)
	s.NoError(err)
	err = base.Join("ignoreme").WriteFile([]byte{}, 0666)
	s.NoError(err)
	err = base.Join("includeme").WriteFile([]byte{}, 0666)
	s.NoError(err)

	subdir := base.Join("subdir")
	err = subdir.Mkdir(0777)
	s.NoError(err)
	err = subdir.Join("ignoreme").WriteFile([]byte{}, 0666)
	s.NoError(err)
	err = subdir.Join("includeme").WriteFile([]byte{}, 0666)
	s.NoError(err)

	service := CreateFilesService(base, s.log)
	s.NotNil(service)
	file, err := service.GetFile(base)
	s.Nil(err)
	s.NotNil(file)

	files := file.Files
	s.Len(files, 4)
	f := files[0]
	s.Equal(".positignore", f.Base)
	s.Nil(f.Exclusion)

	f = files[1]
	s.Equal("ignoreme", f.Base)
	s.NotNil(f.Exclusion)
	s.Equal("ignore*", f.Exclusion.Pattern)

	f = files[2]
	s.Equal("includeme", f.Base)
	s.Nil(f.Exclusion)

	sd := files[3]
	s.Equal("subdir", sd.Base)
	s.Nil(sd.Exclusion)
	s.Len(sd.Files, 2)

	f = sd.Files[0]
	s.Equal("ignoreme", f.Base)
	s.NotNil(f.Exclusion)
	s.Equal("ignore*", f.Exclusion.Pattern)

	f = sd.Files[1]
	s.Equal("includeme", f.Base)
	s.Nil(f.Exclusion)
}
