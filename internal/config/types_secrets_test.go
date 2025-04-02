package config

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"testing"

	"github.com/stretchr/testify/suite"
)

type ConfigHasSecretSuite struct {
	suite.Suite
}

func TestConfig_HasSecret(t *testing.T) {
	suite.Run(t, new(ConfigHasSecretSuite))
}

func (s *ConfigHasSecretSuite) TestSecretExists() {
	c := &Config{
		Secrets: []string{"SECRET1", "SECRET2", "SECRET3"},
	}
	s.True(c.HasSecret("SECRET2"))
}

func (s *ConfigHasSecretSuite) TestSecretDoesNotExist() {
	c := &Config{
		Secrets: []string{"SECRET1", "SECRET2", "SECRET3"},
	}
	s.False(c.HasSecret("SECRET4"))
}

func (s *ConfigHasSecretSuite) TestEmptySecretsList() {
	c := &Config{}
	s.False(c.HasSecret("SECRET1"))
}

func (s *ConfigHasSecretSuite) TestCaseSensitiveCheck() {
	c := &Config{
		Secrets: []string{"SECRET1", "SECRET2", "SECRET3"},
	}
	s.False(c.HasSecret("secret2"))
}
