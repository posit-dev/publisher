package state

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"os"
	"testing"

	"github.com/rstudio/publishing-client/internal/types"
	"github.com/rstudio/publishing-client/internal/util/utiltest"
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
			{Name: "FOO", Value: types.NewOptional("1")},
			{Name: "BAR"},
		}
	})
	err = deployment.load(serializer)
	s.Nil(err)
	expectedEnv := []ConnectEnvironmentVariable{
		{Name: "FOO", Value: types.NewOptional("1"), fromEnvironment: false},
		{Name: "BAR", Value: types.NewOptional("2"), fromEnvironment: true},
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
			{Name: "FOO", Value: types.NewOptional("1")},
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
			{Name: "FOO", Value: types.NewOptional("1")},
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
			ConnectionTimeout:  types.NewOptional[int32](1),
			ReadTimeout:        types.NewOptional[int32](2),
			InitTimeout:        types.NewOptional[int32](3),
			IdleTimeout:        types.NewOptional[int32](4),
			MaxProcesses:       types.NewOptional[int32](5),
			MinProcesses:       types.NewOptional[int32](6),
			MaxConnsPerProcess: types.NewOptional[int32](7),
			LoadFactor:         types.NewOptional[float64](0.5),
			RunAs:              "me",
			RunAsCurrentUser:   types.NewOptional(true),
			MemoryRequest:      types.NewOptional[int64](1000),
			MemoryLimit:        types.NewOptional[int64](1001),
			CPURequest:         types.NewOptional[float64](0.25),
			CPULimit:           types.NewOptional[float64](0.75),
			ServiceAccountName: "my-service-account",
			DefaultImageName:   "my-super-duper-content-image",
		},
		Environment: []ConnectEnvironmentVariable{
			{Name: "FOO", Value: types.NewOptional("1")},
		},
	}
	added := ConnectDeployment{}
	merged := orig
	merged.Merge(&added)
	s.Equal(orig, merged)
	s.Equal("My Best Content Ever!", merged.Content.Title)
}

func (s *ConnectStateSuite) TestMergeAll() {
	orig := ConnectDeployment{
		Content: ConnectContent{
			Name:               "content-name-should-be-unique",
			Title:              "My Best Content Ever!",
			Description:        "Need I say more?",
			AccessType:         "acl",
			ConnectionTimeout:  types.NewOptional[int32](1),
			ReadTimeout:        types.NewOptional[int32](2),
			InitTimeout:        types.NewOptional[int32](3),
			IdleTimeout:        types.NewOptional[int32](4),
			MaxProcesses:       types.NewOptional[int32](5),
			MinProcesses:       types.NewOptional[int32](6),
			MaxConnsPerProcess: types.NewOptional[int32](7),
			LoadFactor:         types.NewOptional[float64](0.5),
			RunAs:              "me",
			RunAsCurrentUser:   types.NewOptional(true),
			MemoryRequest:      types.NewOptional[int64](1000),
			MemoryLimit:        types.NewOptional[int64](1001),
			CPURequest:         types.NewOptional[float64](0.25),
			CPULimit:           types.NewOptional[float64](0.75),
			ServiceAccountName: "my-service-account",
			DefaultImageName:   "my-super-duper-content-image",
		},
		Environment: []ConnectEnvironmentVariable{
			{Name: "FOO", Value: types.NewOptional("1")},
		},
	}
	added := ConnectDeployment{
		Content: ConnectContent{
			Name:               "updated-content-name",
			Title:              "Better than the Best!",
			Description:        "Indeed",
			AccessType:         "logged_in",
			ConnectionTimeout:  types.NewOptional[int32](11),
			ReadTimeout:        types.NewOptional[int32](12),
			InitTimeout:        types.NewOptional[int32](13),
			IdleTimeout:        types.NewOptional[int32](14),
			MaxProcesses:       types.NewOptional[int32](15),
			MinProcesses:       types.NewOptional[int32](16),
			MaxConnsPerProcess: types.NewOptional[int32](17),
			LoadFactor:         types.NewOptional[float64](0.1),
			RunAs:              "you",
			RunAsCurrentUser:   types.NewOptional(false),
			MemoryRequest:      types.NewOptional[int64](9000),
			MemoryLimit:        types.NewOptional[int64](9001),
			CPURequest:         types.NewOptional[float64](1.5),
			CPULimit:           types.NewOptional[float64](2.5),
			ServiceAccountName: "your-service-account",
			DefaultImageName:   "different-content-image",
		},
		Environment: []ConnectEnvironmentVariable{
			{Name: "FOO", Value: types.NewOptional("2")},
			{Name: "BAR", Value: types.NewOptional("42")},
		},
	}
	merged := orig
	merged.Merge(&added)
	s.Equal(added, merged)
	s.Equal("Better than the Best!", merged.Content.Title)
	s.Len(merged.Environment, 2)
	s.Equal(types.NewOptional("2"), merged.Environment[0].Value)
}
