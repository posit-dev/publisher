package deployments

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/publishing-client/internal/bundles"
	"github.com/rstudio/publishing-client/internal/state"
	"github.com/rstudio/publishing-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type ServicesSuite struct {
	utiltest.Suite
}

func TestServicesSuite(t *testing.T) {
	suite.Run(t, new(ServicesSuite))
}

func (s *ServicesSuite) TestCreateDeploymentsService() {
	deployment := state.NewDeployment()
	service := CreateDeploymentsService(deployment)
	s.NotNil(service)
}

func (s *ServicesSuite) TestGetDeployment() {
	src := state.NewDeployment()
	service := CreateDeploymentsService(src)
	res := service.GetDeployment()
	s.Equal(src, res)
}

func (s *ServicesSuite) TestSetDeploymentFiles() {
	src := state.NewDeployment()
	s.Equal(src.Manifest.Files, bundles.ManifestFileMap(bundles.ManifestFileMap{}))

	service := CreateDeploymentsService(src)

	files := []string{"file"}
	res := service.SetDeploymentFiles(files)
	s.Equal(src, res)
	s.Equal(res.Manifest.Files, bundles.ManifestFileMap{"file": bundles.ManifestFile{Checksum: ""}})
}
