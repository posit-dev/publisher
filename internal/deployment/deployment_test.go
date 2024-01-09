package deployment

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io/fs"
	"testing"
	"time"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/schema"
	"github.com/rstudio/connect-client/internal/types"
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

func (s *DeploymentSuite) createDeploymentFile(name string) *Deployment {
	path := GetDeploymentPath(s.cwd, name)
	d := New()
	d.ServerType = accounts.ServerTypeConnect
	d.DeployedAt = time.Now().UTC().Format(time.RFC3339)
	d.Configuration.Type = config.ContentTypePythonDash
	d.Configuration.Entrypoint = "app.py"
	err := d.WriteFile(path)
	s.NoError(err)
	return d
}

func (s *DeploymentSuite) TestNew() {
	deployment := New()
	s.NotNil(deployment)
	s.Equal(schema.DeploymentSchemaURL, deployment.Schema)
}

func (s *DeploymentSuite) TestGetDeploymentPath() {
	path := GetDeploymentPath(s.cwd, "myTargetName")
	s.Equal(path, s.cwd.Join(".posit", "publish", "deployments", "myTargetName.toml"))
}

func (s *DeploymentSuite) TestFromFile() {
	expected := s.createDeploymentFile("myTargetName")
	path := GetDeploymentPath(s.cwd, "myTargetName")
	actual, err := FromFile(path)
	s.NoError(err)
	s.NotNil(actual)
	s.Equal(expected, actual)
}

func (s *DeploymentSuite) TestFromExampleFile() {
	realDir, err := util.Getwd(nil)
	s.NoError(err)
	schemaDir := realDir.Join("..", "schema", "schemas")

	path := schemaDir.Join("record.toml")
	d, err := FromFile(path)
	s.NoError(err)
	s.NotNil(d)

	cfgPath := schemaDir.Join("deploy.toml")
	cfg, err := config.FromFile(cfgPath)
	s.NoError(err)
	s.Equal(cfg, &d.Configuration)

	s.Equal("https://connect.example.com", d.ServerURL)
	s.Equal(types.ContentID("de2e7bdb-b085-401e-a65c-443e40009749"), d.ID)
	s.Equal(types.BundleID("123"), d.BundleID)
	s.Equal("https://connect.example.com/__api__/v1/content/de2e7bdb-b085-401e-a65c-443e40009749/bundles/123/download", d.BundleURL)
}

func (s *DeploymentSuite) TestFromFileErr() {
	deployment, err := FromFile(s.cwd.Join("nonexistent.toml"))
	s.ErrorIs(err, fs.ErrNotExist)
	s.Nil(deployment)
}

func (s *DeploymentSuite) TestWriteFile() {
	configFile := GetDeploymentPath(s.cwd, "myTargetName")
	deployment := New()
	err := deployment.WriteFile(configFile)
	s.NoError(err)
}

func (s *DeploymentSuite) TestWriteFileErr() {
	configFile := GetDeploymentPath(s.cwd, "myTargetName")
	readonlyFile := util.NewPath(configFile.Path(), afero.NewReadOnlyFs(configFile.Fs()))
	deployment := New()
	err := deployment.WriteFile(readonlyFile)
	s.NotNil(err)
}
