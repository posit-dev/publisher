package pydeps

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type QMDContentsSuite struct {
	utiltest.Suite
}

func TestQMDContentsSuite(t *testing.T) {
	suite.Run(t, new(QMDContentsSuite))
}

func (s *QMDContentsSuite) TestGetQuartoFilePythonCode() {
	cwd, err := util.Getwd(nil)
	s.NoError(err)
	path := cwd.Join("testdata", "test.qmd")

	inputs, err := GetQuartoFilePythonCode(path)
	s.Nil(err)
	s.Equal("import that\n\nthat.do_something()\n", inputs)
}
