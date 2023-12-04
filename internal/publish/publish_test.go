package publish

// Copyright (C) 2023 by Posit Software, PBC.
import (
	"errors"
	"testing"
	"time"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/clients/connect"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/deployment"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type PublishSuite struct {
	utiltest.Suite
	log logging.Logger
	fs  afero.Fs
	cwd util.Path
}

func TestPublishSuite(t *testing.T) {
	suite.Run(t, new(PublishSuite))
}

func (s *PublishSuite) SetupTest() {
	s.log = logging.New()
	s.fs = afero.NewMemMapFs()
	cwd, err := util.Getwd(s.fs)
	s.Nil(err)
	s.cwd = cwd

	// Create a virtual version of the cwd so NewWalker
	// can Chdir there. This is needed because the
	// gitignore.IgnoreList uses relative paths internally
	// and expects to be able to call Abs on them.
	cwd.MkdirAll(0700)
	cwd.Join("app.py").WriteFile([]byte("import flask\n"), 0600)
	cwd.Join("requirements.txt").WriteFile([]byte("flask\n"), 0600)

}

func (s *PublishSuite) TestNewFromState() {
	stateStore := state.Empty()
	publisher := NewFromState(stateStore)
	s.Equal(stateStore, publisher.(*defaultPublisher).State)
}

func (s *PublishSuite) TestPublishWithClient() {
	s.publishWithClient(nil, nil, nil, nil, nil, nil, nil)
}

func (s *PublishSuite) TestPublishWithClientUpdate() {
	target := deployment.New()
	target.Id = "myContentID"
	s.publishWithClient(target, nil, nil, nil, nil, nil, nil)
}

func (s *PublishSuite) TestPublishWithClientFailCreate() {
	createErr := errors.New("error from Create")
	s.publishWithClient(nil, createErr, nil, nil, nil, nil, createErr)
}

func (s *PublishSuite) TestPublishWithClientFailUpdate() {
	target := deployment.New()
	target.Id = "myContentID"
	updateErr := errors.New("error from Update")
	s.publishWithClient(target, updateErr, nil, nil, nil, nil, updateErr)
}

func (s *PublishSuite) TestPublishWithClientFailEnvVars() {
	envVarErr := errors.New("error from SetEnvVars")
	s.publishWithClient(nil, nil, envVarErr, nil, nil, nil, envVarErr)
}

func (s *PublishSuite) TestPublishWithClientFailUpload() {
	uploadErr := errors.New("error from Upload")
	s.publishWithClient(nil, nil, nil, uploadErr, nil, nil, uploadErr)
}

func (s *PublishSuite) TestPublishWithClientFailDeploy() {
	deployErr := errors.New("error from Deploy")
	s.publishWithClient(nil, nil, nil, nil, deployErr, nil, deployErr)
}

func (s *PublishSuite) TestPublishWithClientFailWaitForTask() {
	waitErr := errors.New("error from WaitForTask")
	s.publishWithClient(nil, nil, nil, nil, nil, waitErr, waitErr)
}

func (s *PublishSuite) publishWithClient(target *deployment.Deployment, createErr, envVarErr, uploadErr, deployErr, waitErr, expectedErr error) {
	bundler, err := bundles.NewBundler(s.cwd, bundles.NewManifest(), nil, s.log)
	s.NoError(err)

	account := &accounts.Account{
		ServerType: accounts.ServerTypeConnect,
		Name:       "test-account",
		URL:        "https://connect.example.com",
	}

	myContentID := types.ContentID("myContentID")
	myBundleID := types.BundleID("myBundleID")
	myTaskID := types.TaskID("myTaskID")

	client := connect.NewMockClient()
	if target == nil {
		client.On("CreateDeployment", mock.Anything).Return(myContentID, createErr)
	}
	client.On("UpdateDeployment", myContentID, mock.Anything).Return(createErr)
	client.On("SetEnvVars", myContentID, mock.Anything).Return(envVarErr)
	client.On("UploadBundle", myContentID, mock.Anything).Return(myBundleID, uploadErr)
	client.On("DeployBundle", myContentID, myBundleID).Return(myTaskID, deployErr)
	client.On("WaitForTask", myTaskID, mock.Anything).Return(waitErr)

	cfg := config.New()
	cfg.Environment = map[string]string{
		"FOO": "BAR",
	}
	stateStore := &state.State{
		Dir:     s.cwd,
		Account: nil,
		Config:  cfg,
		Target:  target,
	}
	publisher := &defaultPublisher{stateStore}
	err = publisher.publishWithClient(bundler, account, client, s.log)
	if expectedErr == nil {
		s.NoError(err)
	} else {
		s.NotNil(err)
		s.Equal(expectedErr.Error(), err.Error())
	}
	if createErr == nil {
		recordPath := deployment.GetLatestDeploymentPath(stateStore.Dir, string(stateStore.Target.Id))
		record, err := deployment.FromFile(recordPath)
		s.NoError(err)
		s.Equal(myContentID, record.Id)
		s.Contains(record.Files, "app.py")
		s.Contains(record.Files, "requirements.txt")
		s.NotEqual(time.Time{}, record.DeployedAt)
		s.True(record.DeployedAt.After(time.Now().UTC().Add(-1 * time.Minute)))
	}
}
