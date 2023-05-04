package state

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"
	"testing"

	"github.com/rstudio/connect-client/internal/apitypes"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type EnvironmentSuite struct {
	utiltest.Suite
}

func TestEnvironmentSuite(t *testing.T) {
	suite.Run(t, new(EnvironmentSuite))
}

func (s *EnvironmentSuite) TestMarshalTextFromEnv() {
	v := ConnectEnvironmentVariable{
		Name:            "FOO",
		fromEnvironment: true,
	}
	out, err := v.MarshalText()
	s.Nil(err)
	s.Equal([]byte("FOO"), out)
}

func (s *EnvironmentSuite) TestMarshalTextWithValue() {
	v := ConnectEnvironmentVariable{
		Name:  "FOO",
		Value: apitypes.NewOptional("abc"),
	}
	out, err := v.MarshalText()
	s.Nil(err)
	s.Equal([]byte("FOO=abc"), out)
}

func (s *EnvironmentSuite) TestMarshalTextEmptyValue() {
	v := ConnectEnvironmentVariable{
		Name:  "FOO",
		Value: apitypes.NewOptional(""),
	}
	out, err := v.MarshalText()
	s.Nil(err)
	s.Equal([]byte("FOO="), out)
}

func (s *EnvironmentSuite) TestUnmarshalTextFromEnvironment() {
	os.Setenv("FOO", "42")
	v := ConnectEnvironmentVariable{}
	err := v.UnmarshalText([]byte("FOO"))
	s.Nil(err)
	expected := ConnectEnvironmentVariable{
		Name:            "FOO",
		Value:           apitypes.NewOptional("42"),
		fromEnvironment: true,
	}
	s.Equal(expected, v)
}

func (s *EnvironmentSuite) TestUnmarshalTextWithValue() {
	v := ConnectEnvironmentVariable{}
	err := v.UnmarshalText([]byte("FOO=42"))
	s.Nil(err)
	expected := ConnectEnvironmentVariable{
		Name:  "FOO",
		Value: apitypes.NewOptional("42"),
	}
	s.Equal(expected, v)
}

func (s *EnvironmentSuite) TestUnmarshalTextEmptyValue() {
	v := ConnectEnvironmentVariable{}
	err := v.UnmarshalText([]byte("FOO="))
	s.Nil(err)
	expected := ConnectEnvironmentVariable{
		Name:  "FOO",
		Value: apitypes.NewOptional(""),
	}
	s.Equal(expected, v)
}
