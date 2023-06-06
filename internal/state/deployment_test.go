package state

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"os"
	"testing"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/apitypes"
	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type DeploymentSuite struct {
	utiltest.Suite
}

func TestDeploymentSuite(t *testing.T) {
	suite.Run(t, new(DeploymentSuite))
}

func (s *DeploymentSuite) TestNewDeployment() {
	d := NewDeployment()
	s.Equal(1, d.Manifest.Version)
}

func (s *DeploymentSuite) TestMergeEmpty() {
	orig := NewDeployment()
	orig.SourceDir = util.NewPath("/my/dir", nil)
	orig.PythonRequirements = []byte("numpy\npandas\n")
	orig.Target.AccountName = "my-account"
	orig.Target.ServerType = accounts.ServerTypeConnect
	orig.Target.ServerURL = "https://connect.example.com"
	orig.Target.ContentId = "abc123"
	orig.Target.ContentName = "super-cool-unique-name"

	merged := orig
	other := NewDeployment()
	merged.Merge(other)
	s.Equal(orig, merged)
}

func (s *DeploymentSuite) TestMergeNonEmpty() {
	orig := NewDeployment()
	orig.SourceDir = util.NewPath("/my/dir", nil)
	orig.PythonRequirements = []byte("numpy\npandas\n")
	orig.Target.AccountName = "my-account"
	orig.Target.ServerType = accounts.ServerTypeConnect
	orig.Target.ServerURL = "https://connect.example.com"
	orig.Target.ContentId = "abc123"
	orig.Target.ContentName = "super-cool-unique-name"

	merged := orig
	other := NewDeployment()
	other.SourceDir = util.NewPath("/other/dir", nil)
	other.PythonRequirements = []byte("flask\n")
	other.Target.AccountName = "your-account"
	other.Target.ServerType = accounts.ServerTypeShinyappsIO
	other.Target.ServerURL = "https://shinyapps.io"
	other.Target.ContentId = apitypes.ContentID("99")
	other.Target.ContentName = apitypes.ContentName("my-app")
	merged.Merge(other)
	s.Equal(other.SourceDir, merged.SourceDir)
	s.Equal([]byte("numpy\npandas\nflask\n"), merged.PythonRequirements)
	s.Equal("your-account", merged.Target.AccountName)
	s.Equal(accounts.ServerTypeShinyappsIO, merged.Target.ServerType)
	s.Equal("https://shinyapps.io", merged.Target.ServerURL)
	s.Equal(apitypes.ContentID("99"), merged.Target.ContentId)
	s.Equal(apitypes.ContentName("my-app"), merged.Target.ContentName)
}

func (s *DeploymentSuite) TestLoadManifest() {
	manifestJson := []byte(`{"version": 1, "platform": "4.1.0"}`)
	filename := "manifest.json"

	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, filename, manifestJson, 0600)
	s.Nil(err)

	deployment := NewDeployment()
	logger := rslog.NewDiscardingLogger()
	path := util.NewPath(filename, fs)
	err = deployment.LoadManifest(path, logger)
	s.Nil(err)
	s.Equal(bundles.Manifest{
		Version:  1,
		Platform: "4.1.0",
		Packages: bundles.PackageMap{},
		Files:    bundles.FileMap{},
	}, deployment.Manifest)
}

func (s *DeploymentSuite) TestLoadManifestDir() {
	manifestJson := []byte(`{"version": 1, "platform": "4.1.0"}`)
	filename := "manifest.json"

	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, filename, manifestJson, 0600)
	s.Nil(err)

	deployment := NewDeployment()
	logger := rslog.NewDiscardingLogger()
	path := util.NewPath(filename, fs).Dir()
	err = deployment.LoadManifest(path, logger)
	s.Nil(err)
	s.Equal(bundles.Manifest{
		Version:  1,
		Platform: "4.1.0",
		Packages: bundles.PackageMap{},
		Files:    bundles.FileMap{},
	}, deployment.Manifest)
}

func (s *DeploymentSuite) TestLoadManifestNonexistentDir() {
	fs := afero.NewMemMapFs()
	deployment := NewDeployment()
	logger := rslog.NewDiscardingLogger()
	path := util.NewPath("/nonexistent", fs)
	err := deployment.LoadManifest(path, logger)
	s.NotNil(err)
	s.ErrorIs(err, os.ErrNotExist)
}

func (s *DeploymentSuite) TestLoadManifestNonexistentFile() {
	fs := afero.NewMemMapFs()
	dir := "/my/dir"
	fs.MkdirAll(dir, 0700)
	deployment := NewDeployment()
	logger := rslog.NewDiscardingLogger()
	path := util.NewPath(dir, fs)
	err := deployment.LoadManifest(path, logger)
	s.NotNil(err)
	s.ErrorIs(err, os.ErrNotExist)
}

func (s *DeploymentSuite) TestSaveLoad() {
	fs := afero.NewMemMapFs()
	dir := "/my/dir"
	logger := rslog.NewDiscardingLogger()
	deployment := NewDeployment()
	deployment.Target.ServerType = accounts.ServerTypeConnect

	configName := "staging"
	path := util.NewPath(dir, fs)
	err := deployment.SaveToFiles(path, configName, logger)
	s.Nil(err)
	loadedData := *deployment
	err = deployment.LoadFromFiles(path, configName, logger)
	s.Nil(err)
	s.Equal(deployment, &loadedData)
}

func (s *DeploymentSuite) TestSaveToFilesErr() {
	fs := utiltest.NewMockFs()
	testError := errors.New("test error from MkdirAll")
	fs.On("MkdirAll", mock.Anything, mock.Anything).Return(testError)
	logger := rslog.NewDiscardingLogger()
	deployment := NewDeployment()
	path := util.NewPath("/nonexistent", fs)
	err := deployment.SaveToFiles(path, "staging", logger)
	s.NotNil(err)
	s.ErrorIs(err, testError)
	fs.AssertExpectations(s.T())
}

func (s *DeploymentSuite) TestSaveErr() {
	serializer := NewMockSerializer()
	testError := errors.New("test error from Save")
	serializer.On("Save", mock.Anything, mock.Anything).Return(testError)
	deployment := NewDeployment()
	err := deployment.Save(serializer)
	s.NotNil(err)
	s.ErrorIs(err, testError)
	serializer.AssertExpectations(s.T())
}

func (s *DeploymentSuite) TestSaveConnectErr() {
	serializer := NewMockSerializer()
	testError := errors.New("test error from Save")
	serializer.On("Save", idLabel, mock.Anything).Return(nil)
	serializer.On("Save", mock.Anything, mock.Anything).Return(testError)
	deployment := NewDeployment()
	deployment.Target.ServerType = accounts.ServerTypeConnect
	err := deployment.Save(serializer)
	s.NotNil(err)
	s.ErrorIs(err, testError)
	serializer.AssertExpectations(s.T())
}

func (s *DeploymentSuite) TestLoadErr() {
	serializer := NewMockSerializer()
	testError := errors.New("test error from Load")
	serializer.On("Load", mock.Anything, mock.Anything).Return(testError)
	deployment := NewDeployment()
	err := deployment.Load(serializer)
	s.NotNil(err)
	s.ErrorIs(err, testError)
	serializer.AssertExpectations(s.T())
}

func (s *DeploymentSuite) TestLoadConnectErr() {
	serializer := NewMockSerializer()
	testError := errors.New("test error from Load")
	serializer.On("Load", idLabel, mock.Anything).Return(nil).Run(func(args mock.Arguments) {
		target := args.Get(1).(*TargetID)
		target.ServerType = accounts.ServerTypeConnect
	})
	serializer.On("Load", mock.Anything, mock.Anything).Return(testError)
	deployment := NewDeployment()
	err := deployment.Load(serializer)
	s.NotNil(err)
	s.ErrorIs(err, testError)
	serializer.AssertExpectations(s.T())
}
