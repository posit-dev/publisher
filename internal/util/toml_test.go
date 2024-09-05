package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"runtime"
	"testing"

	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type TOMLSuite struct {
	utiltest.Suite
	testdata AbsolutePath
}

func TestTOMLSuite(t *testing.T) {
	suite.Run(t, new(TOMLSuite))
}

func (s *TOMLSuite) SetupTest() {
	_, filename, _, ok := runtime.Caller(0)
	s.True(ok)
	dir := NewAbsolutePath(filename, nil).Dir()
	s.testdata = dir.Join("testdata", "toml")
}

func (s *TOMLSuite) TestReadTOMLFile() {
	path := s.testdata.Join("good.toml")
	content := map[string]any{}
	err := ReadTOMLFile(path, &content)
	s.NoError(err)
}

func (s *TOMLSuite) TestReadTOMLFileBad() {
	path := s.testdata.Join("bad.toml")
	content := map[string]any{}
	err := ReadTOMLFile(path, &content)
	agentErr, ok := err.(*types.AgentError)
	s.True(ok)
	s.Equal(InvalidTOMLCode, agentErr.Code)
}

func (s *TOMLSuite) TestReadTOMLFileBadKey() {
	path := s.testdata.Join("badkey.toml")
	content := struct {
		A int64 `toml:"a"`
		// no 'b'
	}{}
	err := ReadTOMLFile(path, &content)
	agentErr, ok := err.(*types.AgentError)
	s.True(ok)
	s.Equal(UnknownTOMLKeyCode, agentErr.Code)
}
