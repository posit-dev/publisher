package pydeps

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/executor/executortest"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type PackageMapperSuite struct {
	utiltest.Suite
}

func TestPackageMapperSuite(t *testing.T) {
	suite.Run(t, new(PackageMapperSuite))
}

func (s *PackageMapperSuite) TestNewPackageMapper() {
	log := logging.New()
	m := NewPackageMapper(log)
	s.NotNil(m.executor)
	s.Nil(m.fs)
	s.Equal(log, m.log)
}

func (s *PackageMapperSuite) TestGetPackageMap() {
	log := logging.New()
	m := NewPackageMapper(log)

	libDir := "/path/to/python/lib/python3.x/site-packages"
	m.fs = afero.NewMemMapFs()
	libPath := util.NewPath(libDir, m.fs)
	libPath.MkdirAll(0777)

	infoDir1 := libPath.Join("MyPackage-1.2.3.dist-info")
	infoDir1.Mkdir(0777)
	infoDir1.Join("top_level.txt").WriteFile([]byte("mypkg\n"), 0666)

	infoDir2 := libPath.Join("other-4.5.6.dist-info")
	infoDir2.Mkdir(0777)

	executor := executortest.NewMockExecutor()
	out := []byte(libDir + "\n/path/to/libraries.zip\n")
	executor.On("RunCommand", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(out, nil, nil)
	m.executor = executor

	mapping, err := m.GetPackageMap("/some/python")
	s.NoError(err)

	s.Equal(PackageMap{
		"mypkg": &PackageSpec{
			Name:    "MyPackage",
			Version: "1.2.3",
		},
		"other": &PackageSpec{
			Name:    "other",
			Version: "4.5.6",
		},
	}, mapping)
}
