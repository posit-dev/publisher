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

type FilesSuite struct {
	utiltest.Suite
	log logging.Logger
}

func TestFilesSuite(t *testing.T) {
	suite.Run(t, new(FilesSuite))
}

func (s *FilesSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *FilesSuite) TestCreateFile() {
	afs := afero.NewMemMapFs()
	path, err := util.Getwd(afs)
	s.NoError(err)
	err = path.MkdirAll(0777)
	s.NoError(err)

	file, err := CreateFile(path, path, nil)
	s.NoError(err)
	s.NotNil(file)
	s.Equal(file.Id, ".")
	s.Equal(file.Rel, ".")
	s.Equal(file.RelDir, ".")
}
