package state

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"os"
	"testing"

	"github.com/rstudio/connect-client/internal/apitypes"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type ConnectStateSuite struct {
	utiltest.Suite
}

func TestConnectStateSuite(t *testing.T) {
	suite.Run(t, new(ConnectStateSuite))
}

func (s *ConnectStateSuite) TestLoad() {
	deployment := ConnectDeployment{}
	serializer := NewMockSerializer()
	err := os.Setenv("BAR", "2")
	s.Nil(err)

	serializer.On("Load", contentLabel, &deployment.Content).Return(nil)
	serializer.On("Load", environmentLabel, mock.Anything).Return(nil).Run(func(args mock.Arguments) {
		envVars := args.Get(1).(*[]ConnectEnvironmentVariable)
		*envVars = []ConnectEnvironmentVariable{
			{Name: "FOO", Value: apitypes.NewOptional("1")},
			{Name: "BAR"},
		}
	})
	err = deployment.load(serializer)
	s.Nil(err)
	expectedEnv := []ConnectEnvironmentVariable{
		{Name: "FOO", Value: apitypes.NewOptional("1"), fromEnvironment: false},
		{Name: "BAR", Value: apitypes.NewOptional("2"), fromEnvironment: true},
	}
	s.Equal(expectedEnv, deployment.Environment)
	serializer.AssertExpectations(s.T())
}

func (s *ConnectStateSuite) TestLoadContentErr() {
	deployment := ConnectDeployment{}
	serializer := NewMockSerializer()
	testError := errors.New("test error from content Load call")
	serializer.On("Load", contentLabel, &deployment.Content).Return(testError)
	err := deployment.load(serializer)
	s.NotNil(err)
	s.ErrorIs(err, testError)
	serializer.AssertExpectations(s.T())
}

func (s *ConnectStateSuite) TestLoadEnvErr() {
	deployment := ConnectDeployment{}
	serializer := NewMockSerializer()
	testError := errors.New("test error from env Load call")
	serializer.On("Load", contentLabel, &deployment.Content).Return(nil)
	serializer.On("Load", environmentLabel, mock.Anything).Return(testError)
	err := deployment.load(serializer)
	s.NotNil(err)
	s.ErrorIs(err, testError)
	serializer.AssertExpectations(s.T())
}

func (s *ConnectStateSuite) TestSave() {
	deployment := ConnectDeployment{
		Environment: []ConnectEnvironmentVariable{
			{Name: "FOO", Value: apitypes.NewOptional("1")},
		},
	}
	serializer := NewMockSerializer()

	serializer.On("Save", contentLabel, &deployment.Content).Return(nil)
	serializer.On("Save", environmentLabel, mock.Anything).Return(nil)
	err := deployment.save(serializer)
	s.Nil(err)
	serializer.AssertExpectations(s.T())
}

func (s *ConnectStateSuite) TestSaveContentErr() {
	deployment := ConnectDeployment{}
	serializer := NewMockSerializer()
	testError := errors.New("test error from content Save call")
	serializer.On("Save", contentLabel, &deployment.Content).Return(testError)
	err := deployment.save(serializer)
	s.NotNil(err)
	s.ErrorIs(err, testError)
	serializer.AssertExpectations(s.T())
}

func (s *ConnectStateSuite) TestSaveEnvErr() {
	deployment := ConnectDeployment{
		Environment: []ConnectEnvironmentVariable{
			{Name: "FOO", Value: apitypes.NewOptional("1")},
		},
	}
	serializer := NewMockSerializer()
	testError := errors.New("test error from env Save call")
	serializer.On("Save", contentLabel, &deployment.Content).Return(nil)
	serializer.On("Save", environmentLabel, mock.Anything).Return(testError)
	err := deployment.save(serializer)
	s.NotNil(err)
	s.ErrorIs(err, testError)
	serializer.AssertExpectations(s.T())
}

func (s *ConnectStateSuite) TestMergeEmpty() {
	orig := ConnectDeployment{
		Content: ConnectContent{
			Name:               "content-name-should-be-unique",
			Title:              "My Best Content Ever!",
			Description:        "Need I say more?",
			AccessType:         "acl",
			ConnectionTimeout:  apitypes.NewOptional[int32](1),
			ReadTimeout:        apitypes.NewOptional[int32](2),
			InitTimeout:        apitypes.NewOptional[int32](3),
			IdleTimeout:        apitypes.NewOptional[int32](4),
			MaxProcesses:       apitypes.NewOptional[int32](5),
			MinProcesses:       apitypes.NewOptional[int32](6),
			MaxConnsPerProcess: apitypes.NewOptional[int32](7),
			LoadFactor:         apitypes.NewOptional[float64](0.5),
			RunAs:              "me",
			RunAsCurrentUser:   apitypes.NewOptional(true),
			MemoryRequest:      apitypes.NewOptional[int64](1000),
			MemoryLimit:        apitypes.NewOptional[int64](1001),
			CPURequest:         apitypes.NewOptional[float64](0.25),
			CPULimit:           apitypes.NewOptional[float64](0.75),
			ServiceAccountName: "my-service-account",
			DefaultImageName:   "my-super-duper-content-image",
		},
		Environment: []ConnectEnvironmentVariable{
			{Name: "FOO", Value: apitypes.NewOptional("1")},
		},
	}
	added := ConnectDeployment{}
	merged := orig
	merged.Merge(&added)
	s.Equal(orig, merged)
	s.Equal(merged.Content.Title, "My Best Content Ever!")
}

func (s *ConnectStateSuite) TestMergeAll() {
	orig := ConnectDeployment{
		Content: ConnectContent{
			Name:               "content-name-should-be-unique",
			Title:              "My Best Content Ever!",
			Description:        "Need I say more?",
			AccessType:         "acl",
			ConnectionTimeout:  apitypes.NewOptional[int32](1),
			ReadTimeout:        apitypes.NewOptional[int32](2),
			InitTimeout:        apitypes.NewOptional[int32](3),
			IdleTimeout:        apitypes.NewOptional[int32](4),
			MaxProcesses:       apitypes.NewOptional[int32](5),
			MinProcesses:       apitypes.NewOptional[int32](6),
			MaxConnsPerProcess: apitypes.NewOptional[int32](7),
			LoadFactor:         apitypes.NewOptional[float64](0.5),
			RunAs:              "me",
			RunAsCurrentUser:   apitypes.NewOptional(true),
			MemoryRequest:      apitypes.NewOptional[int64](1000),
			MemoryLimit:        apitypes.NewOptional[int64](1001),
			CPURequest:         apitypes.NewOptional[float64](0.25),
			CPULimit:           apitypes.NewOptional[float64](0.75),
			ServiceAccountName: "my-service-account",
			DefaultImageName:   "my-super-duper-content-image",
		},
		Environment: []ConnectEnvironmentVariable{
			{Name: "FOO", Value: apitypes.NewOptional("1")},
		},
	}
	added := ConnectDeployment{
		Content: ConnectContent{
			Name:               "updated-content-name",
			Title:              "Better than the Best!",
			Description:        "Indeed",
			AccessType:         "logged_in",
			ConnectionTimeout:  apitypes.NewOptional[int32](11),
			ReadTimeout:        apitypes.NewOptional[int32](12),
			InitTimeout:        apitypes.NewOptional[int32](13),
			IdleTimeout:        apitypes.NewOptional[int32](14),
			MaxProcesses:       apitypes.NewOptional[int32](15),
			MinProcesses:       apitypes.NewOptional[int32](16),
			MaxConnsPerProcess: apitypes.NewOptional[int32](17),
			LoadFactor:         apitypes.NewOptional[float64](0.1),
			RunAs:              "you",
			RunAsCurrentUser:   apitypes.NewOptional(false),
			MemoryRequest:      apitypes.NewOptional[int64](9000),
			MemoryLimit:        apitypes.NewOptional[int64](9001),
			CPURequest:         apitypes.NewOptional[float64](1.5),
			CPULimit:           apitypes.NewOptional[float64](2.5),
			ServiceAccountName: "your-service-account",
			DefaultImageName:   "different-content-image",
		},
		Environment: []ConnectEnvironmentVariable{
			{Name: "FOO", Value: apitypes.NewOptional("2")},
			{Name: "BAR", Value: apitypes.NewOptional("42")},
		},
	}
	merged := orig
	merged.Merge(&added)
	s.Equal(added, merged)
	s.Equal(merged.Content.Title, "Better than the Best!")
	s.Len(merged.Environment, 2)
	s.Equal(merged.Environment[0].Value, apitypes.NewOptional("2"))
}
