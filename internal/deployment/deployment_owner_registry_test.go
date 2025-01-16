package deployment

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type DeploymentOwnerMapSuite struct {
	utiltest.Suite
}

func TestDeploymentOwnerMapSuite(t *testing.T) {
	suite.Run(t, new(DeploymentOwnerMapSuite))
}

func (s *DeploymentOwnerMapSuite) SetupTest() {
	ActiveDeploymentRegistry.Reset()
}

func (s *DeploymentOwnerMapSuite) TestReset() {
	s.Equal(0, len(ActiveDeploymentRegistry.m))

	ActiveDeploymentRegistry.Set("abc/def", "123")
	ActiveDeploymentRegistry.Set("abc/def2", "124")
	ActiveDeploymentRegistry.Set("abc/def3", "125")
	s.Equal(3, len(ActiveDeploymentRegistry.m))

	ActiveDeploymentRegistry.Reset()
	s.Equal(0, len(ActiveDeploymentRegistry.m))
}

func (s *DeploymentOwnerMapSuite) TestSet() {
	ActiveDeploymentRegistry.Set("abc/def", "")
	s.Equal(0, len(ActiveDeploymentRegistry.m))

	ActiveDeploymentRegistry.Set("abc/def", "123")
	ActiveDeploymentRegistry.Set("abc/def2", "124")
	ActiveDeploymentRegistry.Set("abc/def3", "125")
	s.Equal(true, ActiveDeploymentRegistry.Check("abc/def", "123"))

}

func (s *DeploymentOwnerMapSuite) TestCheckAndSet() {
	ActiveDeploymentRegistry.Set("abc/def", "123")
	// existing w/ owner id
	s.Equal(true, ActiveDeploymentRegistry.Check("abc/def", "123"))
	// existing w/ non-owner id
	s.Equal(false, ActiveDeploymentRegistry.Check("abc/def", "456"))
	// non-existing
	s.Equal(false, ActiveDeploymentRegistry.Check("xyz", "789"))
}

func (s *DeploymentOwnerMapSuite) TestClear() {
	ActiveDeploymentRegistry.Set("abc/def", "123")
	ActiveDeploymentRegistry.Set("abc/def2", "124")
	ActiveDeploymentRegistry.Set("abc/def3", "125")
	s.Equal(3, len(ActiveDeploymentRegistry.m))

	// Valid request w/ local ID match
	ActiveDeploymentRegistry.Clear("abc/def", "123")
	s.Equal(2, len(ActiveDeploymentRegistry.m))

	// Ignored request w/ non match
	ActiveDeploymentRegistry.Clear("abc/def3", "999")
	// still should be same number as before the operation
	s.Equal(2, len(ActiveDeploymentRegistry.m))
}
