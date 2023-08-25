package files

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type FilesSuite struct {
	utiltest.Suite
	log events.Logger
}

func TestFilesSuite(t *testing.T) {
	suite.Run(t, new(FilesSuite))
}

func (s *FilesSuite) SetupSuite() {
	s.log = events.DefaultLogger()
}

func (s *FilesSuite) TestCreateFile() {
	afs := afero.NewMemMapFs()
	pathname := "."
	path := util.NewPath(pathname, afs)
	file, err := CreateFile(path, nil)
	s.NotNil(file)
	s.NoError(err)
	s.Equal(file.Pathname, pathname)
}
