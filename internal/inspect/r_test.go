package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type RSuite struct {
	utiltest.Suite
	cwd util.AbsolutePath
}

func TestRSuite(t *testing.T) {
	suite.Run(t, new(RSuite))
}

func (s *RSuite) SetupTest() {
	cwd, err := util.Getwd(afero.NewMemMapFs())
	s.NoError(err)
	s.cwd = cwd
	err = cwd.MkdirAll(0700)
	s.NoError(err)

	interpreters.NewRInterpreter = func(baseDir util.AbsolutePath, rExec util.Path, log logging.Logger) interpreters.RInterpreter {
		i := interpreters.NewMockRInterpreter()
		i.On("Init").Return(nil)
		i.On("RequiresR", mock.Anything).Return(false, nil)
		i.On("GetLockFilePath").Return(util.RelativePath{}, false, nil)
		return i
	}
}

func (s *RSuite) TestNewRInspector() {
	log := logging.New()
	rPath := util.NewPath("/usr/bin/R", nil)

	i, err := NewRInspector(s.cwd, rPath, log)
	s.NoError(err)

	inspector := i.(*defaultRInspector)
	s.Equal(s.cwd, inspector.base)
	s.Equal(log, inspector.log)
}
