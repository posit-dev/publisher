package deployment

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io/fs"
	"strings"
	"testing"
	"time"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/schema"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type DeploymentSuite struct {
	utiltest.Suite
	cwd util.AbsolutePath
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
	d.Configuration = config.New()
	d.ServerType = accounts.ServerTypeConnect
	d.DeployedAt = time.Now().UTC().Format(time.RFC3339)
	d.Configuration.Type = config.ContentTypePythonDash
	d.Configuration.Entrypoint = "app.py"
	d.Configuration.Python = &config.Python{
		Version:        "3.4.5",
		PackageManager: "pip",
	}
	err := d.WriteFile(path)
	s.NoError(err)
	return d
}

func (s *DeploymentSuite) TestNew() {
	d := New()
	s.NotNil(d)
	s.Equal(schema.DeploymentSchemaURL, d.Schema)
	s.NotEmpty(d.CreatedAt)
	s.Empty(d.DeployedAt)
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

	cfgPath := schemaDir.Join("config.toml")
	cfg, err := config.FromFile(cfgPath)
	s.NoError(err)

	// Deployments do not round-trip config comments
	cfg.Comments = nil
	s.Equal(cfg, d.Configuration)

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
	deploymentFile := GetDeploymentPath(s.cwd, "myTargetName")
	d := New()
	err := d.WriteFile(deploymentFile)
	s.NoError(err)

	content, err := deploymentFile.ReadFile()
	s.NoError(err)
	stringContent := string(content)
	firstLine := strings.Split(stringContent, "\n")[0]
	s.Equal(autogenHeader, firstLine+"\n")

	// This is a pre-deployment, so should not contain certain fields.
	s.NotContains(stringContent, "id")
	s.NotContains(stringContent, "deployed_at")
	s.NotContains(stringContent, "bundle_id")
	s.NotContains(stringContent, "bundle_url")
	s.NotContains(stringContent, "dashboard_url")
	s.NotContains(stringContent, "direct_url")
	s.NotContains(stringContent, "deployment_error")
	s.NotContains(stringContent, "files")
	s.NotContains(stringContent, "[configuration")
}

func (s *DeploymentSuite) TestWriteFileErr() {
	deploymentFile := GetDeploymentPath(s.cwd, "myTargetName")
	readonlyFs := afero.NewReadOnlyFs(deploymentFile.Fs())
	readonlyFile := deploymentFile.WithFs(readonlyFs)
	deployment := New()
	err := deployment.WriteFile(readonlyFile)
	s.NotNil(err)
}

func (s *DeploymentSuite) TestUntitledDeploymentName() {
	name, err := UntitledDeploymentName(s.cwd)
	s.NoError(err)
	s.Equal("Untitled-1", name)
}

func (s *DeploymentSuite) TestUntitledDeploymentName2() {
	name, err := UntitledDeploymentName(s.cwd)
	s.NoError(err)
	f, err := GetDeploymentPath(s.cwd, name).Create()
	s.NoError(err)
	err = f.Close()
	s.NoError(err)
	name, err = UntitledDeploymentName(s.cwd)
	s.NoError(err)
	s.Equal("Untitled-2", name)
}
