package publish

// Copyright (C) 2023 by Posit Software, PBC.
import (
	"errors"
	"testing"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/api_client/clients/clienttest"
	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/config"
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

func (s *PublishSuite) TestCreateBundle() {
	dest := s.cwd.Join("output_dir", "bundle.tar.gz")
	stateStore := &state.State{
		Dir:     s.cwd,
		Account: nil,
		Config:  config.New(),
		Target:  nil,
	}
	publisher := &defaultPublisher{stateStore}
	err := publisher.CreateBundleFromDirectory(dest, s.log)
	s.NoError(err)
	s.True(dest.Exists())
}

func (s *PublishSuite) TestCreateBundleFailCreate() {
	afs := utiltest.NewMockFs()
	testError := errors.New("error from Create")
	afs.On("Create", mock.Anything).Return(nil, testError)
	dest := util.NewPath("anypath", afs)

	stateStore := &state.State{
		Dir:     s.cwd,
		Account: nil,
		Config:  config.New(),
		Target:  nil,
	}
	publisher := &defaultPublisher{stateStore}
	err := publisher.CreateBundleFromDirectory(dest, s.log)
	s.ErrorIs(err, testError)
}

func (s *PublishSuite) TestPublishWithClient() {
	s.publishWithClient(nil, nil, nil, nil, nil)
}

func (s *PublishSuite) TestPublishWithClientFailCreate() {
	createErr := errors.New("error from Create")
	s.publishWithClient(createErr, nil, nil, nil, createErr)
}

func (s *PublishSuite) TestPublishWithClientFailUpload() {
	uploadErr := errors.New("error from Upload")
	s.publishWithClient(nil, uploadErr, nil, nil, uploadErr)
}

func (s *PublishSuite) TestPublishWithClientFailDeploy() {
	deployErr := errors.New("error from Deploy")
	s.publishWithClient(nil, nil, deployErr, nil, deployErr)
}

func (s *PublishSuite) TestPublishWithClientFailWaitForTask() {
	waitErr := errors.New("error from WaitForTask")
	s.publishWithClient(nil, nil, nil, waitErr, waitErr)
}

func (s *PublishSuite) publishWithClient(createErr, uploadErr, deployErr, waitErr, expectedErr error) {
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

	client := clienttest.NewMockClient()
	client.On("CreateDeployment", mock.Anything).Return(myContentID, createErr)
	client.On("UploadBundle", myContentID, mock.Anything).Return(myBundleID, uploadErr)
	client.On("DeployBundle", myContentID, myBundleID).Return(myTaskID, deployErr)
	client.On("WaitForTask", myTaskID, mock.Anything).Return(waitErr)

	stateStore := &state.State{
		Dir:     s.cwd,
		Account: nil,
		Config:  config.New(),
		Target:  nil,
	}
	publisher := &defaultPublisher{stateStore}
	err = publisher.publishWithClient(bundler, account, client, s.log)
	if expectedErr == nil {
		s.NoError(err)
	} else {
		s.Equal(expectedErr.Error(), err.Error())
	}
}
