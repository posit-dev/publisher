package publish

// Copyright (C) 2023 by Posit Software, PBC.
import (
	"bytes"
	"errors"
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/logging/loggingtest"
	"github.com/posit-dev/publisher/internal/project"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type PublishSuite struct {
	utiltest.Suite
	log       logging.Logger
	logBuffer *bytes.Buffer
	fs        afero.Fs
	cwd       util.AbsolutePath
}

type mockPackageMapper struct {
	mock.Mock
}

func (m *mockPackageMapper) GetManifestPackages(base util.AbsolutePath, lockfilePath util.AbsolutePath, log logging.Logger) (bundles.PackageMap, error) {
	args := m.Called(base, lockfilePath)
	pkgs := args.Get(0)
	if pkgs == nil {
		return nil, args.Error(1)
	} else {
		return pkgs.(bundles.PackageMap), args.Error(1)
	}
}

type publishErrsMock struct {
	rPackageErr error
	authErr     error
	capErr      error
	checksErr   error
	createErr   error
	envVarErr   error
	uploadErr   error
	deployErr   error
	waitErr     error
	validateErr error
}

func TestPublishSuite(t *testing.T) {
	suite.Run(t, new(PublishSuite))
}

const renvLockContent = `{
	"R": {
		"Version": "4.3.0",
		"Repositories": [
			{
				"Name": "CRAN",
				"URL": "https://cran.rstudio.com"
			}
		]
	},
	"Packages": {
		"mypkg": {
			"Package": "mypkg",
			"Version": "1.2.3",
			"Source": "Repository",
			"Repository": "CRAN",
			"Requirements": [
			"R"
			],
			"Hash": "470851b6d5d0ac559e9d01bb352b4021"
		}
	}
}
`

func (s *PublishSuite) SetupTest() {
	s.logBuffer = new(bytes.Buffer)
	opts := &slog.HandlerOptions{Level: slog.LevelInfo}
	stdLogger := slog.New(slog.NewTextHandler(s.logBuffer, opts))
	s.log = logging.FromStdLogger(stdLogger)
	s.fs = afero.NewMemMapFs()
	cwd, err := util.Getwd(s.fs)
	s.Nil(err)
	s.cwd = cwd

	// Create a virtual version of the cwd so NewWalker
	// can Chdir there. This is needed because the
	// matcher.MatchList uses relative paths internally
	// and expects to be able to call Abs on them.
	cwd.MkdirAll(0700)
	cwd.Join("app.py").WriteFile([]byte("import flask\n"), 0600)
	cwd.Join("requirements.txt").WriteFile([]byte("flask\n"), 0600)
	cwd.Join("renv.lock").WriteFile([]byte(renvLockContent), 0600)

}

func (s *PublishSuite) TestNewFromState() {
	stateStore := state.Empty()
	publisher, err := NewFromState(stateStore, util.Path{}, events.NewNullEmitter(), logging.New())
	s.NoError(err)
	s.Equal(stateStore, publisher.(*defaultPublisher).State)
}

func (s *PublishSuite) TestPublishWithClientNewSuccess() {
	s.publishWithClient(nil, &publishErrsMock{}, nil)
}

func (s *PublishSuite) TestPublishWithClientNewUpdate() {
	target := deployment.New()
	target.ID = "myContentID"
	// Make CreatedAt earlier so it will differ from DeployedAt.
	target.CreatedAt = time.Now().Add(-time.Hour).Format(time.RFC3339)
	s.publishWithClient(target, &publishErrsMock{}, nil)
}

func (s *PublishSuite) TestPublishWithClientNewFailAuth() {
	authErr := errors.New("error from TestAuthentication")
	s.publishWithClient(nil, &publishErrsMock{authErr: authErr}, authErr)
}

func (s *PublishSuite) TestPublishWithClientNewFailCapabilities() {
	capErr := errors.New("error from CheckCapabilities")
	s.publishWithClient(nil, &publishErrsMock{capErr: capErr}, capErr)
}

func (s *PublishSuite) TestPublishWithClientNewFailCreate() {
	createErr := errors.New("error from Create")
	s.publishWithClient(nil, &publishErrsMock{createErr: createErr}, createErr)
}

func (s *PublishSuite) TestPublishWithClientNewFailEnvVars() {
	envVarErr := errors.New("error from SetEnvVars")
	s.publishWithClient(nil, &publishErrsMock{envVarErr: envVarErr}, envVarErr)
}

func (s *PublishSuite) TestPublishWithClientNewFailUpload() {
	uploadErr := errors.New("error from Upload")
	s.publishWithClient(nil, &publishErrsMock{uploadErr: uploadErr}, uploadErr)
}

func (s *PublishSuite) TestPublishWithClientNewFailDeploy() {
	deployErr := errors.New("error from Deploy")
	s.publishWithClient(nil, &publishErrsMock{deployErr: deployErr}, deployErr)
}

func (s *PublishSuite) TestPublishWithClientNewFailWaitForTask() {
	waitErr := errors.New("error from WaitForTask")
	s.publishWithClient(nil, &publishErrsMock{waitErr: waitErr}, waitErr)
}

func (s *PublishSuite) TestPublishWithClientNewFailValidation() {
	validateErr := errors.New("error from ValidateDeployment")
	s.publishWithClient(nil, &publishErrsMock{validateErr: validateErr}, validateErr)
}

func (s *PublishSuite) TestPublishWithClientNewRPackages() {
	rPackageErr := errors.New("error from GetManifestPackages")
	s.publishWithClient(nil, &publishErrsMock{rPackageErr: rPackageErr}, rPackageErr)
}

func (s *PublishSuite) TestPublishWithClientRedeployFailAuth() {
	target := deployment.New()
	target.ID = "myContentID"
	authErr := errors.New("error from TestAuthentication")
	s.publishWithClient(target, &publishErrsMock{authErr: authErr}, authErr)
}

func (s *PublishSuite) TestPublishWithClientRedeployFailCapabilities() {
	target := deployment.New()
	target.ID = "myContentID"
	capErr := errors.New("error from CheckCapabilities")
	s.publishWithClient(target, &publishErrsMock{capErr: capErr}, capErr)
}

func (s *PublishSuite) TestPublishWithClientRedeployErrors() {
	target := deployment.New()
	target.ID = "myContentID"

	// Fail the preflight existing content checks. Further testing of these will
	// occur in the connect_client package

	// Forbidden
	checksErr := types.NewAgentError(
		events.DeploymentFailedCode,
		errors.New("failed"),
		nil,
	)
	s.publishWithClient(target, &publishErrsMock{capErr: checksErr}, checksErr)
	s.Equal(
		checksErr.Message,
		"Failed.",
	)

}

func (s *PublishSuite) TestPublishWithClientRedeployFailUpdate() {
	target := deployment.New()
	target.ID = "myContentID"
	updateErr := errors.New("error from Update")
	s.publishWithClient(target, &publishErrsMock{createErr: updateErr}, updateErr)
}

func (s *PublishSuite) TestPublishWithClientRedeployFailEnvVars() {
	target := deployment.New()
	target.ID = "myContentID"
	envVarErr := errors.New("error from SetEnvVars")
	s.publishWithClient(target, &publishErrsMock{envVarErr: envVarErr}, envVarErr)
}

func (s *PublishSuite) TestPublishWithClientRedeployFailUpload() {
	target := deployment.New()
	target.ID = "myContentID"
	uploadErr := errors.New("error from Upload")
	s.publishWithClient(target, &publishErrsMock{uploadErr: uploadErr}, uploadErr)
}

func (s *PublishSuite) TestPublishWithClientRedeployFailDeploy() {
	target := deployment.New()
	target.ID = "myContentID"
	deployErr := errors.New("error from Deploy")
	s.publishWithClient(target, &publishErrsMock{deployErr: deployErr}, deployErr)
}

func (s *PublishSuite) TestPublishWithClientRedeployFailWaitForTask() {
	target := deployment.New()
	target.ID = "myContentID"
	waitErr := errors.New("error from WaitForTask")
	s.publishWithClient(target, &publishErrsMock{waitErr: waitErr}, waitErr)
}

func (s *PublishSuite) TestPublishWithClientRedeployFailValidation() {
	validateErr := errors.New("error from ValidateDeployment")
	s.publishWithClient(nil, &publishErrsMock{validateErr: validateErr}, validateErr)
}

func (s *PublishSuite) publishWithClient(
	target *deployment.Deployment,
	errsMock *publishErrsMock,
	expectedErr error) {

	account := &accounts.Account{
		ServerType: accounts.ServerTypeConnect,
		Name:       "test-account",
		URL:        "https://connect.example.com",
	}

	myContentID := types.ContentID("myContentID")
	myLockedContentID := types.ContentID("myLockedContentID")
	myBundleID := types.BundleID("myBundleID")
	myTaskID := types.TaskID("myTaskID")

	client := connect.NewMockClient()
	if target == nil {
		client.On("CreateDeployment", mock.Anything, mock.Anything).Return(myContentID, errsMock.createErr)
	}
	client.On("TestAuthentication", mock.Anything).Return(&connect.User{}, errsMock.authErr)
	client.On("CheckCapabilities", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(errsMock.capErr)
	client.On("ContentDetails", myContentID, mock.Anything, mock.Anything).Return(errsMock.checksErr)
	client.On("ContentDetails", myLockedContentID, mock.Anything, mock.Anything).Return(errsMock.checksErr)
	client.On("UpdateDeployment", myContentID, mock.Anything, mock.Anything).Return(errsMock.createErr)
	client.On("SetEnvVars", myContentID, mock.Anything, mock.Anything).Return(errsMock.envVarErr)
	client.On("UploadBundle", myContentID, mock.Anything, mock.Anything).Return(myBundleID, errsMock.uploadErr)
	client.On("DeployBundle", myContentID, myBundleID, mock.Anything).Return(myTaskID, errsMock.deployErr)
	client.On("WaitForTask", myTaskID, mock.Anything, mock.Anything).Return(errsMock.waitErr)
	client.On("ValidateDeployment", myContentID, mock.Anything).Return(errsMock.validateErr)

	cfg := config.New()
	cfg.Type = config.ContentTypePythonDash
	cfg.Entrypoint = "app.py"
	cfg.Environment = map[string]string{
		"FOO": "BAR",
	}
	cfg.Python = &config.Python{
		Version:        "3.4.5",
		PackageManager: "pip",
	}
	cfg.R = &config.R{
		Version:        "4.3.2",
		PackageManager: "renv",
		PackageFile:    "renv.lock",
	}
	saveName := ""
	targetName := ""
	recordName := "" // name we will find the deployment record under

	if target != nil {
		targetName = "targetToLoad"
		recordName = targetName

		// Make CreatedAt earlier so it will differ from DeployedAt.
		target.CreatedAt = time.Now().Add(-time.Hour).Format(time.RFC3339)
	} else {
		saveName = "saveAsThis"
		recordName = saveName
	}
	stateStore := &state.State{
		Dir: s.cwd,
		Account: &accounts.Account{
			URL: "https://connect.example.com",
		},
		Config:     cfg,
		ConfigName: "myConfig",
		Target:     target,
		TargetName: targetName,
		SaveName:   saveName,
	}

	emitter := events.NewCapturingEmitter()

	publisher := &defaultPublisher{
		State:   stateStore,
		log:     s.log,
		emitter: emitter,
	}

	rPackageMapper := &mockPackageMapper{}
	if errsMock.rPackageErr != nil {
		rPackageMapper.On("GetManifestPackages", mock.Anything, mock.Anything, mock.Anything).Return(nil, errsMock.rPackageErr)
	} else {
		rPackageMapper.On("GetManifestPackages", mock.Anything, mock.Anything, mock.Anything).Return(bundles.PackageMap{}, nil)
	}
	publisher.rPackageMapper = rPackageMapper

	err := publisher.publishWithClient(account, client)
	if expectedErr == nil {
		s.NoError(err)
	} else {
		s.NotNil(err)
		s.Equal(expectedErr.Error(), err.Error())

		publisher.emitErrorEvents(err)
	}
	if target != nil {
		// Creation date is not updated on deployment
		s.Equal(stateStore.Target.CreatedAt, stateStore.Target.CreatedAt)
		if stateStore.Target != nil {
			// Successful redeployment should update the timestamp.
			s.NotEqual(stateStore.Target.CreatedAt, stateStore.Target.DeployedAt)
		}
	}
	couldCreateDeployment := (errsMock.rPackageErr == nil &&
		errsMock.authErr == nil &&
		errsMock.capErr == nil &&
		errsMock.checksErr == nil &&
		errsMock.createErr == nil)
	if (stateStore.Target != nil) || couldCreateDeployment {
		// Either a pre-existing deployment record, or we got far enough to create one
		recordPath := deployment.GetDeploymentPath(stateStore.Dir, recordName)
		record, err := deployment.FromFile(recordPath)
		s.NoError(err)

		if target != nil && target.ID == myLockedContentID {
			s.Equal(myLockedContentID, record.ID)
		} else {
			s.Equal(myContentID, record.ID)
		}
		s.Equal(project.Version, record.ClientVersion)
		s.NotEqual("", record.DeployedAt)
		s.Equal("myConfig", record.ConfigName)
		s.NotNil(record.Configuration)

		if couldCreateDeployment && record.ID == myContentID {
			logs := s.logBuffer.String()
			s.Contains(logs, "content_id="+myContentID)
			s.Equal("https://connect.example.com/connect/#/apps/myContentID", record.DashboardURL)
			s.Equal("https://connect.example.com/content/myContentID/", record.DirectURL)
			s.Equal("https://connect.example.com/connect/#/apps/myContentID/logs", record.LogsURL)

			// Files are written after upload.
			if errsMock.uploadErr == nil {
				s.Contains(record.Files, "app.py")
				s.Contains(record.Files, "requirements.txt")
				s.Equal([]string{"flask"}, record.Requirements)
				s.Contains(record.Renv.Packages, renv.PackageName("mypkg"))
			}
		}
	}
	// Ensure we have not created a bad deployment record (#1112)
	badPath := deployment.GetDeploymentPath(stateStore.Dir, "")
	exists, err := badPath.Exists()
	s.NoError(err)
	s.False(exists)
}

func (s *PublishSuite) TestEmitErrorEventsNoTarget() {
	expectedErr := errors.New("test error")
	log := logging.New()

	emitter := events.NewCapturingEmitter()
	publisher := &defaultPublisher{
		State:   &state.State{},
		log:     log,
		emitter: emitter,
	}

	publisher.emitErrorEvents(expectedErr)

	// We should emit a phase failure event and a publishing failure event.
	s.Len(emitter.Events, 2)
	for _, event := range emitter.Events {
		s.True(strings.HasSuffix(event.Type, "/failure"))
		s.Equal("Test error.", event.Data["message"])
	}
	s.Equal("publish/failure", emitter.Events[1].Type)
}

func (s *PublishSuite) TestEmitErrorEventsWithTarget() {
	expectedErr := errors.New("test error")
	log := logging.New()

	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	const targetID types.ContentID = "abc123"

	emitter := events.NewCapturingEmitter()
	publisher := &defaultPublisher{
		State: &state.State{
			Dir: base,
			Account: &accounts.Account{
				URL: "connect.example.com",
			},
			Target: &deployment.Deployment{
				ID: targetID,
			},
		},
		log:     log,
		emitter: emitter,
	}

	publisher.emitErrorEvents(expectedErr)

	// We should emit a phase failure event and a publishing failure event.
	s.Len(emitter.Events, 2)
	for _, event := range emitter.Events {
		s.True(strings.HasSuffix(event.Type, "/failure"))
		s.Equal("Test error.", event.Data["message"])
		s.Equal(util.GetDashboardURL("connect.example.com", targetID), event.Data["dashboardUrl"])
		s.Equal(util.GetDirectURL("connect.example.com", targetID), event.Data["url"])
		s.Equal(util.GetLogsURL("connect.example.com", targetID), event.Data["logsUrl"])
	}
	s.Equal("publish/failure", emitter.Events[1].Type)
}

func (s *PublishSuite) TestGetDashboardURL() {
	expected := "https://connect.example.com:1234/connect/#/apps/d0e5c94a-d37f-4f26-bfc5-515c4c5ea50f"
	s.Equal(expected, util.GetDashboardURL("https://connect.example.com:1234", "d0e5c94a-d37f-4f26-bfc5-515c4c5ea50f"))
}

func (s *PublishSuite) TestGetDirectURL() {
	expected := "https://connect.example.com:1234/content/d0e5c94a-d37f-4f26-bfc5-515c4c5ea50f/"
	s.Equal(expected, util.GetDirectURL("https://connect.example.com:1234", "d0e5c94a-d37f-4f26-bfc5-515c4c5ea50f"))
}

func (s *PublishSuite) TestGetLogsURL() {
	expected := "https://connect.example.com:1234/connect/#/apps/d0e5c94a-d37f-4f26-bfc5-515c4c5ea50f/logs"
	s.Equal(expected, util.GetLogsURL("https://connect.example.com:1234", "d0e5c94a-d37f-4f26-bfc5-515c4c5ea50f"))
}

func (s *PublishSuite) TestLogAppInfo() {
	accountURL := "https://connect.example.com:1234"
	contentID := types.ContentID("myContentID")
	directURL := util.GetDirectURL(accountURL, contentID)
	dashboardURL := util.GetDashboardURL(accountURL, contentID)

	buf := new(bytes.Buffer)
	a := mock.Anything
	log := loggingtest.NewMockLogger()
	log.On("Info", "Deployment information", a, a, a, a, a, a, a, a, a, a, a, a).Return()

	logAppInfo(buf, accountURL, contentID, log, nil)
	str := buf.String()
	s.Contains(str, directURL)
	s.Contains(str, dashboardURL)
}

func (s *PublishSuite) TestLogAppInfoErr() {
	accountURL := "https://connect.example.com:1234"
	contentID := types.ContentID("myContentID")
	directURL := util.GetDirectURL(accountURL, contentID)
	dashboardURL := util.GetDashboardURL(accountURL, contentID)
	logsURL := util.GetLogsURL(accountURL, contentID)

	buf := new(bytes.Buffer)

	testError := errors.New("test error")
	logAppInfo(buf, accountURL, contentID, nil, testError)
	str := buf.String()
	s.NotContains(str, directURL)
	s.Contains(str, dashboardURL)
	s.Contains(str, logsURL)
}

func (s *PublishSuite) TestLogAppInfoErrNoContentID() {
	accountURL := "https://connect.example.com:1234"
	contentID := types.ContentID("")

	buf := new(bytes.Buffer)
	testError := errors.New("test error")
	logAppInfo(buf, accountURL, contentID, nil, testError)
	s.Equal("", buf.String())
}
