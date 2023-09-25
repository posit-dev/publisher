package services

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type LocalTokenSuite struct {
	utiltest.Suite
}

func TestLocalTokenSuite(t *testing.T) {
	suite.Run(t, new(LocalTokenSuite))
}

func (s *LocalTokenSuite) TestNewLocalToken() {
	token1, err := NewLocalToken()
	s.NoError(err)
	token2, err := NewLocalToken()
	s.NoError(err)
	s.NotEqual(token1, token2)
}
