package deployment

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io/fs"
	"testing"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type DeploymentSuite struct {
	utiltest.Suite
	cwd util.Path
}

func TestDeploymentSuite(t *testing.T) {
	suite.Run(t, new(DeploymentSuite))
}

func (s *DeploymentSuite) SetupTest() {
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
}

func (s *DeploymentSuite) createDeploymentFile(name string) {
	configFile := GetLatestDeploymentPath(s.cwd, name)
	deployment := New()
	deployment.ServerType = accounts.ServerTypeConnect
	err := deployment.WriteFile(configFile)
	s.NoError(err)
}

func (s *DeploymentSuite) TestNew() {
	deployment := New()
	s.NotNil(deployment)
	s.Equal(DeploymentSchema, deployment.Schema)
}

func (s *DeploymentSuite) TestGetLatestDeploymentPath() {
	path := GetLatestDeploymentPath(s.cwd, "myTargetID")
	s.Equal(path, s.cwd.Join(".posit", "deployments", "myTargetID", "latest.toml"))
}

func (s *DeploymentSuite) TestGetLatestDeploymentHistoryPath() {
	path, err := GetDeploymentHistoryPath(s.cwd, "myTargetID")
	s.NoError(err)
	s.Equal(path, s.cwd.Join(".posit", "deployments", "myTargetID", "v1.toml"))

	f, err := path.Create()
	s.NoError(err)
	err = f.Close()
	s.NoError(err)

	path, err = GetDeploymentHistoryPath(s.cwd, "myTargetID")
	s.NoError(err)
	s.Equal(path, s.cwd.Join(".posit", "deployments", "myTargetID", "v2.toml"))
}

func (s *DeploymentSuite) TestFromFile() {
	s.createDeploymentFile("myTargetID")
	path := GetLatestDeploymentPath(s.cwd, "myTargetID")
	deployment, err := FromFile(path)
	s.NoError(err)
	s.NotNil(deployment)
	s.Equal(accounts.ServerTypeConnect, deployment.ServerType)
}

func (s *DeploymentSuite) TestFromFileErr() {
	deployment, err := FromFile(s.cwd.Join("nonexistent.toml"))
	s.ErrorIs(err, fs.ErrNotExist)
	s.Nil(deployment)
}

func (s *DeploymentSuite) TestWriteFile() {
	configFile := GetLatestDeploymentPath(s.cwd, "myTargetID")
	deployment := New()
	err := deployment.WriteFile(configFile)
	s.NoError(err)
}

func (s *DeploymentSuite) TestWriteFileErr() {
	configFile := GetLatestDeploymentPath(s.cwd, "myTargetID")
	readonlyFile := util.NewPath(configFile.Path(), afero.NewReadOnlyFs(configFile.Fs()))
	deployment := New()
	err := deployment.WriteFile(readonlyFile)
	s.NotNil(err)
}
