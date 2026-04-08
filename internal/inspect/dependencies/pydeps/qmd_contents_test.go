package pydeps

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
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
	s.Equal("import that\nfrom example import *\n\nthat.do_something()\n", inputs)
}

