package publish

// Copyright (C) 2023 by Posit Software, PBC.
import (
	"bytes"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/clients/connect_cloud"
	"github.com/posit-dev/publisher/internal/clients/connect_cloud_logs"
	"github.com/posit-dev/publisher/internal/clients/connect_cloud_upload"
	clienttypes "github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/logging/loggingtest"
	"github.com/posit-dev/publisher/internal/project"
	connect_cloud2 "github.com/posit-dev/publisher/internal/publish/connect_cloud"
	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/server_type"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

// BasePublishSuite provides common functionality for publish testing
type BasePublishSuite struct {
	utiltest.Suite
	log       logging.Logger
	logBuffer *bytes.Buffer
	fs        afero.Fs
	cwd       util.AbsolutePath
}

// PublishConnectSuite extends BasePublishSuite for Connect Server testing
type PublishConnectSuite struct {
	BasePublishSuite
}

// PublishConnectCloudSuite extends BasePublishSuite for Connect Cloud testing

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
	rPackageErr     error
	authErr         error
	capabilitiesErr error
	checksErr       error
	createErr       error
	envVarErr       error
	uploadErr       error
	deployErr       error
	waitErr         error
	validateErr     error
}

func TestPublishSuite(t *testing.T) {
	suite.Run(t, new(PublishConnectSuite))
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

func (s *BasePublishSuite) SetupTest() {
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

func (s *BasePublishSuite) TearDownTest() {
	connectClientFactory = connect.NewConnectClient
	cloudClientFactory = connect_cloud.NewConnectCloudClientWithAuth
	connect_cloud2.UploadAPIClientFactory = connect_cloud_upload.NewConnectCloudUploadClient
	connect_cloud2.LogsClientFactory = connect_cloud_logs.NewConnectCloudLogsClient
	rPackageMapperFactory = renv.NewPackageMapper
}

func (s *PublishConnectSuite) TestNewFromState() {
	stateStore := state.Empty()
	stateStore.Dir = s.cwd
	stateStore.Account.ServerType = server_type.ServerTypeConnect
	mockRIntr := interpreters.NewMockRInterpreter()
	mockPyIntr := interpreters.NewMockPythonInterpreter()
	mockRIntr.On("GetRExecutable").Return(util.NewAbsolutePath("/path/to/r", nil), nil)
	mockPyIntr.On("GetPythonExecutable").Return(util.NewAbsolutePath("/path/to/python", nil), nil)
	publisher, err := NewFromState(stateStore, mockRIntr, mockPyIntr, events.NewNullEmitter(), logging.New())
	s.NoError(err)
	s.Equal(stateStore, publisher.(*defaultPublisher).State)
}

func (s *PublishConnectSuite) TestPublishWithClientNewSuccess() {
	s.publishWithClient(nil, &publishErrsMock{}, nil)
}

func (s *PublishConnectSuite) TestPublishWithClientNewUpdate() {
	target := deployment.New()
	target.ID = "myContentID"
	// Make CreatedAt earlier so it will differ from DeployedAt.
	target.CreatedAt = time.Now().Add(-time.Hour).Format(time.RFC3339)
	s.publishWithClient(target, &publishErrsMock{}, nil)
}

func (s *PublishConnectSuite) TestPublishWithClientNewFailAuth() {
	authErr := errors.New("error from TestAuthentication")
	s.publishWithClient(nil, &publishErrsMock{authErr: authErr}, authErr)
}

func (s *PublishConnectSuite) TestPublishWithClientNewFailCapabilities() {
	capabilitiesErr := errors.New("error from CheckCapabilities")
	s.publishWithClient(nil, &publishErrsMock{capabilitiesErr: capabilitiesErr}, capabilitiesErr)
}

func (s *PublishConnectSuite) TestPublishWithClientNewFailCreate() {
	createErr := errors.New("error from Create")
	s.publishWithClient(nil, &publishErrsMock{createErr: createErr}, createErr, func(options *publishTestOptions) {
		options.expectContentID = false
	})
}

func (s *PublishConnectSuite) TestPublishWithClientNewFailEnvVars() {
	envVarErr := errors.New("error from SetEnvVars")
	s.publishWithClient(nil, &publishErrsMock{envVarErr: envVarErr}, envVarErr)
}

func (s *PublishConnectSuite) TestPublishWithClientNewFailUpload() {
	uploadErr := errors.New("error from Upload")
	s.publishWithClient(nil, &publishErrsMock{uploadErr: uploadErr}, uploadErr)
}

func (s *PublishConnectSuite) TestPublishWithClientNewFailDeploy() {
	deployErr := errors.New("error from Deploy")
	s.publishWithClient(nil, &publishErrsMock{deployErr: deployErr}, deployErr)
}

func (s *PublishConnectSuite) TestPublishWithClientNewFailWaitForTask() {
	waitErr := errors.New("error from WaitForTask")
	s.publishWithClient(nil, &publishErrsMock{waitErr: waitErr}, waitErr)
}

func (s *PublishConnectSuite) TestPublishWithClientNewFailValidation() {
	validateErr := errors.New("error from ValidateDeployment")
	s.publishWithClient(nil, &publishErrsMock{validateErr: validateErr}, validateErr)
}

func (s *PublishConnectSuite) TestPublishWithClientNewRPackages() {
	rPackageErr := errors.New("error from GetManifestPackages")
	s.publishWithClient(nil, &publishErrsMock{rPackageErr: rPackageErr}, rPackageErr)
}

func (s *PublishConnectSuite) TestPublishWithClientRedeployFailAuth() {
	target := deployment.New()
	target.ID = "myContentID"
	authErr := errors.New("error from TestAuthentication")
	s.publishWithClient(target, &publishErrsMock{authErr: authErr}, authErr)
}

func (s *PublishConnectSuite) TestPublishWithClientRedeployFailCapabilities() {
	target := deployment.New()
	target.ID = "myContentID"
	capErr := errors.New("error from CheckCapabilities")
	s.publishWithClient(target, &publishErrsMock{capabilitiesErr: capErr}, capErr)
}

func (s *PublishConnectSuite) TestPublishWithClientRedeployErrors() {
	target := deployment.New()
	target.ID = "myContentID"

	// Fail the preflight existing content checks. Further testing of these will
	// occur in the connect_client package

	// Forbidden
	capabilitiesErr := types.NewAgentError(
		events.DeploymentFailedCode,
		errors.New("failed"),
		nil,
	)
	s.publishWithClient(target, &publishErrsMock{capabilitiesErr: capabilitiesErr}, capabilitiesErr)
	s.Equal(
		capabilitiesErr.Message,
		"Failed.",
	)

}

func (s *PublishConnectSuite) TestPublishWithClientRedeployFailUpdate() {
	target := deployment.New()
	target.ID = "myContentID"
	updateErr := errors.New("error from Update")
	s.publishWithClient(target, &publishErrsMock{createErr: updateErr}, updateErr)
}

func (s *PublishConnectSuite) TestPublishWithClientRedeployFailEnvVars() {
	target := deployment.New()
	target.ID = "myContentID"
	envVarErr := errors.New("error from SetEnvVars")
	s.publishWithClient(target, &publishErrsMock{envVarErr: envVarErr}, envVarErr)
}

func (s *PublishConnectSuite) TestPublishWithClientRedeployFailUpload() {
	target := deployment.New()
	target.ID = "myContentID"
	uploadErr := errors.New("error from Upload")
	s.publishWithClient(target, &publishErrsMock{uploadErr: uploadErr}, uploadErr)
}

func (s *PublishConnectSuite) TestPublishWithClientRedeployFailDeploy() {
	target := deployment.New()
	target.ID = "myContentID"
	deployErr := errors.New("error from Deploy")
	s.publishWithClient(target, &publishErrsMock{deployErr: deployErr}, deployErr)
}

func (s *PublishConnectSuite) TestPublishWithClientRedeployFailWaitForTask() {
	target := deployment.New()
	target.ID = "myContentID"
	waitErr := errors.New("error from WaitForTask")
	s.publishWithClient(target, &publishErrsMock{waitErr: waitErr}, waitErr)
}

func (s *PublishConnectSuite) TestPublishWithClientRedeployFailValidation() {
	validateErr := errors.New("error from ValidateDeployment")
	s.publishWithClient(nil, &publishErrsMock{validateErr: validateErr}, validateErr)
}

type publishTestOptions struct {
	expectContentID bool
}

func defaultPublishTestOptions() *publishTestOptions {
	return &publishTestOptions{
		expectContentID: true,
	}
}

func (s *PublishConnectSuite) publishWithClient(
	target *deployment.Deployment,
	errsMock *publishErrsMock,
	expectedErr error,
	optionFns ...func(options *publishTestOptions),
) {
	options := defaultPublishTestOptions()
	for _, fn := range optionFns {
		fn(options)
	}

	account := &accounts.Account{
		ServerType: server_type.ServerTypeConnect,
		Name:       "test-account",
		URL:        "https://connect.example.com",
	}

	myContentID := types.ContentID("myContentID")
	myLockedContentID := types.ContentID("myLockedContentID")
	myBundleID := types.BundleID("myBundleID")
	myTaskID := types.TaskID("myTaskID")

	client := connect.NewMockClient()
	connectClientFactory = func(account *accounts.Account, timeout time.Duration, emitter events.Emitter, log logging.Logger) (connect.APIClient, error) {
		return client, nil
	}
	if target == nil {
		client.On("CreateDeployment", mock.Anything, mock.Anything).Return(myContentID, errsMock.createErr)
	}
	client.On("TestAuthentication", mock.Anything).Return(&connect.User{}, errsMock.authErr)
	client.On("CheckCapabilities", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(errsMock.capabilitiesErr)
	client.On("ContentDetails", myContentID, mock.Anything, mock.Anything).Return(errsMock.checksErr)
	client.On("ContentDetails", myLockedContentID, mock.Anything, mock.Anything).Return(errsMock.checksErr)
	client.On("UpdateDeployment", myContentID, mock.Anything, mock.Anything).Return(errsMock.createErr)
	client.On("SetEnvVars", myContentID, mock.Anything, mock.Anything).Return(errsMock.envVarErr)
	client.On("UploadBundle", myContentID, mock.Anything, mock.Anything).Return(myBundleID, errsMock.uploadErr)
	client.On("DeployBundle", myContentID, myBundleID, mock.Anything).Return(myTaskID, errsMock.deployErr)
	client.On("WaitForTask", myTaskID, mock.Anything, mock.Anything).Return(errsMock.waitErr)
	client.On("ValidateDeployment", myContentID, mock.Anything).Return(errsMock.validateErr)

	cfg := config.New()
	cfg.ProductType = config.ProductTypeConnect
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
		saveName = targetName // need to do this to mimic behavior within publish.NewFromState

		// Make CreatedAt earlier so it will differ from DeployedAt.
		target.CreatedAt = time.Now().Add(-time.Hour).Format(time.RFC3339)
	} else {
		saveName = "saveAsThis"
		targetName = saveName
		recordName = saveName // need to do this to mimic behavior within publish.NewFromState
	}
	stateStore := &state.State{
		Dir:        s.cwd,
		Account:    account,
		Config:     cfg,
		ConfigName: "myConfig",
		Target:     target,
		TargetName: targetName,
		SaveName:   saveName,
	}

	emitter := events.NewCapturingEmitter()

	mockRIntr := interpreters.NewMockRInterpreter()
	mockPyIntr := interpreters.NewMockPythonInterpreter()
	mockRIntr.On("GetRExecutable").Return(util.NewAbsolutePath("/path/to/r", nil), nil)
	mockPyIntr.On("GetPythonExecutable").Return(util.NewAbsolutePath("/path/to/python", nil), nil)

	rPackageMapper := &mockPackageMapper{}
	if errsMock.rPackageErr != nil {
		rPackageMapper.On("GetManifestPackages", mock.Anything, mock.Anything, mock.Anything).Return(nil, errsMock.rPackageErr)
	} else {
		rPackageMapper.On("GetManifestPackages", mock.Anything, mock.Anything, mock.Anything).Return(bundles.PackageMap{}, nil)
	}

	rPackageMapperFactory = func(base util.AbsolutePath, rExecutable util.Path, log logging.Logger) (renv.PackageMapper, error) {
		return rPackageMapper, nil
	}

	publisher, err := NewFromState(stateStore, mockRIntr, mockPyIntr, emitter, s.log)
	s.NoError(err)

	err = publisher.PublishDirectory()
	if expectedErr == nil {
		s.NoError(err)
	} else {
		s.NotNil(err)
		s.Equal(expectedErr.Error(), err.Error())

		publisher.(*defaultPublisher).emitErrorEvents(err)
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
		errsMock.capabilitiesErr == nil &&
		errsMock.checksErr == nil &&
		errsMock.createErr == nil)
	if (stateStore.Target != nil) || couldCreateDeployment {
		// Either a pre-existing deployment record, or we got far enough to create one
		recordPath := deployment.GetDeploymentPath(stateStore.Dir, recordName)
		record, err := deployment.FromFile(recordPath)
		s.NoError(err)

		if options.expectContentID {
			if target != nil && target.ID == myLockedContentID {
				s.Equal(myLockedContentID, record.ID)
			} else {
				s.Equal(myContentID, record.ID)
			}
		} else {
			s.Equal(types.ContentID(""), record.ID)
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

func (s *PublishConnectSuite) TestEmitErrorEventsNoTarget() {
	expectedErr := errors.New("test error")
	log := logging.New()

	emitter := events.NewCapturingEmitter()
	state := &state.State{
		Config: &config.Config{
			ProductType: config.ProductTypeConnect,
		},
	}
	publisher := &defaultPublisher{
		log:           log,
		emitter:       emitter,
		PublishHelper: publishhelper.NewPublishHelper(state, s.log),
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

func (s *PublishConnectSuite) TestEmitErrorEventsWithTarget() {
	expectedErr := errors.New("test error")
	log := logging.New()

	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	const targetID types.ContentID = "abc123"

	emitter := events.NewCapturingEmitter()
	state := &state.State{
		Dir: base,
		Config: &config.Config{
			ProductType: config.ProductTypeConnect,
		},
		Account: &accounts.Account{
			URL: "connect.example.com",
		},
		Target: &deployment.Deployment{
			ID:           targetID,
			DashboardURL: "https://dashboard.url",
			DirectURL:    "https://direct.url",
			LogsURL:      "https://logs.url",
		},
	}
	publisher := &defaultPublisher{
		log:           log,
		emitter:       emitter,
		PublishHelper: publishhelper.NewPublishHelper(state, s.log),
	}

	publisher.emitErrorEvents(expectedErr)

	// We should emit a phase failure event and a publishing failure event.
	s.Len(emitter.Events, 2)
	for _, event := range emitter.Events {
		s.True(strings.HasSuffix(event.Type, "/failure"))
		s.Equal("Test error.", event.Data["message"])
		s.Equal("https://dashboard.url", event.Data["dashboardUrl"])
		s.Equal("https://direct.url", event.Data["url"])
		s.Equal("https://logs.url", event.Data["logsUrl"])
	}
	s.Equal("publish/failure", emitter.Events[1].Type)
}

func (s *PublishConnectSuite) TestGetDashboardURL() {
	expected := "https://connect.example.com:1234/connect/#/apps/d0e5c94a-d37f-4f26-bfc5-515c4c5ea50f"
	s.Equal(expected, util.GetDashboardURL("https://connect.example.com:1234", "d0e5c94a-d37f-4f26-bfc5-515c4c5ea50f"))
}

func (s *PublishConnectSuite) TestGetDirectURL() {
	expected := "https://connect.example.com:1234/content/d0e5c94a-d37f-4f26-bfc5-515c4c5ea50f/"
	s.Equal(expected, util.GetDirectURL("https://connect.example.com:1234", "d0e5c94a-d37f-4f26-bfc5-515c4c5ea50f"))
}

func (s *PublishConnectSuite) TestGetLogsURL() {
	expected := "https://connect.example.com:1234/connect/#/apps/d0e5c94a-d37f-4f26-bfc5-515c4c5ea50f/logs"
	s.Equal(expected, util.GetLogsURL("https://connect.example.com:1234", "d0e5c94a-d37f-4f26-bfc5-515c4c5ea50f"))
}

func (s *PublishConnectSuite) TestLogAppInfo() {
	accountURL := "https://connect.example.com:1234"
	contentID := types.ContentID("myContentID")
	directURL := util.GetDirectURL(accountURL, contentID)
	dashboardURL := util.GetDashboardURL(accountURL, contentID)

	buf := new(bytes.Buffer)
	a := mock.Anything
	log := loggingtest.NewMockLogger()
	log.On("Info", "Deployment information", a, a, a, a, a, a, a, a, a, a, a, a).Return()

	publisher := &defaultPublisher{
		log: log,
		PublishHelper: &publishhelper.PublishHelper{
			State: &state.State{
				Target: &deployment.Deployment{
					ID:           contentID,
					DirectURL:    directURL,
					DashboardURL: dashboardURL,
				},
				Account: &accounts.Account{
					URL: accountURL,
				},
			},
		},
	}

	publisher.logAppInfo(buf, log, nil)
	str := buf.String()
	s.Contains(str, directURL)
	s.Contains(str, dashboardURL)
}

func (s *PublishConnectSuite) TestLogAppInfoErr() {
	accountURL := "https://connect.example.com:1234"
	contentID := types.ContentID("myContentID")
	directURL := util.GetDirectURL(accountURL, contentID)
	dashboardURL := util.GetDashboardURL(accountURL, contentID)
	logsURL := util.GetLogsURL(accountURL, contentID)

	publisher := &defaultPublisher{
		PublishHelper: &publishhelper.PublishHelper{
			State: &state.State{
				Target: &deployment.Deployment{
					ID:           contentID,
					DirectURL:    directURL,
					DashboardURL: dashboardURL,
					LogsURL:      logsURL,
				},
				Account: &accounts.Account{
					URL: accountURL,
				},
			},
		},
	}

	buf := new(bytes.Buffer)
	testError := errors.New("test error")
	publisher.logAppInfo(buf, nil, testError)
	str := buf.String()
	s.NotContains(str, directURL)
	s.Contains(str, dashboardURL)
	s.Contains(str, logsURL)
}

func (s *PublishConnectSuite) TestLogAppInfoErrNoContentID() {
	accountURL := "https://connect.example.com:1234"
	contentID := types.ContentID("")

	publisher := &defaultPublisher{
		PublishHelper: &publishhelper.PublishHelper{
			State: &state.State{
				Target: &deployment.Deployment{
					ID: contentID,
				},
				Account: &accounts.Account{
					URL: accountURL,
				},
			},
		},
	}

	buf := new(bytes.Buffer)
	testError := errors.New("test error")
	publisher.logAppInfo(buf, nil, testError)
	s.Equal("", buf.String())
}

type PublishConnectCloudSuite struct {
	BasePublishSuite
}

// mockCloudError represents errors in the Cloud publishing process
type mockCloudError struct {
	createContentErr    error
	updateContentErr    error
	revisionErr         error
	uploadErr           error
	publishContentErr   error
	rPackageErr         error
	getContentErr       error
	getAuthorizationErr error
	watchLogsErr        error
}

func TestPublishConnectCloudSuite(t *testing.T) {
	suite.Run(t, new(PublishConnectCloudSuite))
}

// Add a test for publishing to Connect Cloud with successful creation
func (s *PublishConnectCloudSuite) TestPublishWithClientNewSuccess() {
	s.publishWithCloudClient(nil, &mockCloudError{}, nil)
}

func (s *PublishConnectCloudSuite) TestPublishWithClientNewFailCreateContent() {
	createContentErr := errors.New("error from CreateContent")
	s.publishWithCloudClient(nil, &mockCloudError{createContentErr: createContentErr}, createContentErr, func(options *cloudPublishTestOptions) {
		options.expectContentID = false
	})
}

func (s *PublishConnectCloudSuite) TestPublishWithClientNewFailUpdateContent() {
	target := deployment.New()
	target.ID = "myContentID"
	updateContentErr := errors.New("error from UpdateContent")
	s.publishWithCloudClient(target, &mockCloudError{updateContentErr: updateContentErr}, updateContentErr)
}

func (s *PublishConnectCloudSuite) TestPublishWithClientNewFailRevision() {
	revisionErr := errors.New("error from GetRevision")
	s.publishWithCloudClient(nil, &mockCloudError{revisionErr: revisionErr}, fmt.Errorf("failed to get revision status: %w", revisionErr))
}

func (s *PublishConnectCloudSuite) TestPublishWithClientNewFailUpload() {
	uploadErr := errors.New("error from UploadBundle")
	s.publishWithCloudClient(nil, &mockCloudError{uploadErr: uploadErr}, fmt.Errorf("bundle upload failed: %w", uploadErr))
}

func (s *PublishConnectCloudSuite) TestPublishWithClientNewFailPublishContent() {
	publishContentErr := errors.New("error from PublishContent")
	s.publishWithCloudClient(nil, &mockCloudError{publishContentErr: publishContentErr}, fmt.Errorf("content publish failed: %w", publishContentErr))
}

func (s *PublishConnectCloudSuite) TestPublishWithClientNewFailRPackages() {
	rPackageErr := errors.New("error from GetManifestPackages")
	s.publishWithCloudClient(nil, &mockCloudError{rPackageErr: rPackageErr}, rPackageErr)
}

func (s *PublishConnectCloudSuite) TestPublishWithClientNewFailGetContent() {
	getContentErr := errors.New("error from GetContent")
	s.publishWithCloudClient(nil, &mockCloudError{getContentErr: getContentErr}, getContentErr)
}

func (s *PublishConnectCloudSuite) TestPublishWithClientNewFailGetAuthorization() {
	getAuthorizationErr := errors.New("error from GetAuthorization")
	s.publishWithCloudClient(nil, &mockCloudError{getAuthorizationErr: getAuthorizationErr}, fmt.Errorf("failed to get authorization token: %w", getAuthorizationErr))
}

func (s *PublishConnectCloudSuite) TestPublishWithClientNewFailWatchLogs() {
	watchLogsErr := errors.New("error from WatchLogs")
	s.publishWithCloudClient(nil, &mockCloudError{watchLogsErr: watchLogsErr}, fmt.Errorf("error watching logs: %w", watchLogsErr))
}

type cloudPublishTestOptions struct {
	expectContentID bool
}

func defaultCloudPublishTestOptions() *cloudPublishTestOptions {
	return &cloudPublishTestOptions{
		expectContentID: true,
	}
}

// publishWithCloudClient is a helper method to test publishing with Connect Cloud
func (s *PublishConnectCloudSuite) publishWithCloudClient(
	target *deployment.Deployment,
	errsMock *mockCloudError,
	expectedErr error,
	optionFns ...func(options *cloudPublishTestOptions),
) {
	options := defaultCloudPublishTestOptions()
	for _, fn := range optionFns {
		fn(options)
	}

	// Create account
	account := &accounts.Account{
		ServerType:       server_type.ServerTypeConnectCloud,
		Name:             "test-cloud-account",
		URL:              "https://api.connect.posit.cloud",
		CloudAccountName: "test-account",
		CloudAccountID:   "account-123",
		CloudEnvironment: types.CloudEnvironmentProduction,
		CloudAccessToken: "test-token", // Add a test token
	}

	// Set up content and revision IDs
	myContentID := types.ContentID("myContentID")
	myRevisionID := "myCloudRevisionID"
	myBundleID := types.BundleID("myCloudBundleID")

	// Create mock Cloud client
	cloudClient := connect_cloud.NewMockClient()
	cloudClientFactory = func(env types.CloudEnvironment, log logging.Logger, timeout time.Duration, account *accounts.Account, authToken types.CloudAuthToken) (connect_cloud.APIClient, error) {
		return cloudClient, nil
	}

	// Setup content response for creation/update
	contentResponse := &clienttypes.ContentResponse{
		ID: myContentID,
		NextRevision: &clienttypes.Revision{
			ID:                    myRevisionID,
			PublishLogChannel:     "publish-log-channel-cloud",
			SourceBundleID:        string(myBundleID),
			SourceBundleUploadURL: "https://upload.url",
		},
	}

	// Mock CreateContent or UpdateContent based on whether we have a target
	if target == nil {
		// We need to match the exact request with the account ID
		cloudClient.On("CreateContent", mock.MatchedBy(func(req *clienttypes.CreateContentRequest) bool {
			return req.AccountID == "account-123"
		})).Return(contentResponse, errsMock.createContentErr)
	} else {
		cloudClient.On("UpdateContent", mock.Anything).Return(contentResponse, errsMock.updateContentErr)
	}

	// Setup revision with successful result when polled
	revision := &clienttypes.Revision{
		ID:                myRevisionID,
		PublishLogChannel: "publish-log-channel-cloud",
		PublishResult:     clienttypes.PublishResultSuccess,
	}
	cloudClient.On("GetRevision", myRevisionID).Return(revision, errsMock.revisionErr)

	// Setup publish content
	cloudClient.On("PublishContent", string(myContentID)).Return(errsMock.publishContentErr)

	// Setup GetContent to return a content response with the updated revision
	// Create a separate response for GetContent with the updated PublishLogChannel
	publishLogChannel := "publish-log-channel-cloud" // Define it here to use in both places
	updatedContentResponse := &clienttypes.ContentResponse{
		ID: myContentID,
		NextRevision: &clienttypes.Revision{
			ID:                myRevisionID,
			PublishLogChannel: publishLogChannel, // This is needed for watchLogs
			PublishResult:     clienttypes.PublishResultSuccess,
		},
	}
	cloudClient.On("GetContent", myContentID).Return(updatedContentResponse, errsMock.getContentErr)

	// Setup GetAuthorization to return a successful response for log channel access
	cloudClient.On("GetAuthorization", mock.MatchedBy(func(req *clienttypes.AuthorizationRequest) bool {
		// Verify the request is for log channel access with the right resource ID and permission
		return req.ResourceType == "log_channel" &&
			req.ResourceID == publishLogChannel &&
			req.Permission == "revision.logs:read"
	})).Return(&clienttypes.AuthorizationResponse{
		Authorized: true,
		Token:      "test-logs-access-token",
	}, errsMock.getAuthorizationErr)

	// Create the mock for connect_cloud_upload client factory
	uploadClient := connect_cloud_upload.NewMockUploadClient()
	uploadClient.On("UploadBundle", mock.Anything).Return(errsMock.uploadErr)

	// Replace the factory function - do this BEFORE creating the publisher
	//origUploadAPIClientFactory = uploadAPIClientFactory
	connect_cloud2.UploadAPIClientFactory = func(uploadURL string, log logging.Logger, timeout time.Duration) connect_cloud_upload.UploadAPIClient {
		return uploadClient
	}

	logsClient := connect_cloud_logs.NewMockLogsClient()
	logsClient.On("WatchLogs", mock.Anything, mock.Anything).Return(errsMock.watchLogsErr)

	connect_cloud2.LogsClientFactory = func(
		environment types.CloudEnvironment,
		logChannel string,
		accessToken string,
		log logging.Logger,
	) connect_cloud_logs.LogsAPIClient {
		return logsClient
	}

	// Create event emitter
	emitter := events.NewCapturingEmitter()

	// Mock interpreters
	mockRIntr := interpreters.NewMockRInterpreter()
	mockPyIntr := interpreters.NewMockPythonInterpreter()
	mockRIntr.On("GetRExecutable").Return(util.NewAbsolutePath("/path/to/r", nil), nil)
	mockPyIntr.On("GetPythonExecutable").Return(util.NewAbsolutePath("/path/to/python", nil), nil)

	// Mock R package mapper
	rPackageMapper := &mockPackageMapper{}
	if errsMock.rPackageErr != nil {
		rPackageMapper.On("GetManifestPackages", mock.Anything, mock.Anything, mock.Anything).Return(nil, errsMock.rPackageErr)
	} else {
		rPackageMapper.On("GetManifestPackages", mock.Anything, mock.Anything, mock.Anything).Return(bundles.PackageMap{}, nil)
	}

	// Replace factory function
	rPackageMapperFactory = func(base util.AbsolutePath, rExecutable util.Path, log logging.Logger) (renv.PackageMapper, error) {
		return rPackageMapper, nil
	}

	// Create config
	cfg := config.New()
	cfg.ProductType = config.ProductTypeConnectCloud
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

	// Setup names for saving
	saveName := ""
	targetName := ""
	recordName := ""

	if target != nil {
		targetName = "targetToLoad"
		recordName = targetName
		saveName = targetName

		// Make CreatedAt earlier so it will differ from DeployedAt
		target.CreatedAt = time.Now().Add(-time.Hour).Format(time.RFC3339)
	} else {
		saveName = "saveAsThis"
		targetName = saveName
		recordName = saveName
	}

	// Create state
	stateStore := &state.State{
		Dir:        s.cwd,
		Account:    account,
		Config:     cfg,
		ConfigName: "myConfig",
		Target:     target,
		TargetName: targetName,
		SaveName:   saveName,
	}

	// Create publisher
	publisher, err := NewFromState(stateStore, mockRIntr, mockPyIntr, emitter, s.log)
	s.NoError(err)

	// Publish directory
	fmt.Printf("\nRunning PublishDirectory with mock client: %v\n", cloudClient)
	err = publisher.PublishDirectory()
	if err != nil {
		fmt.Printf("Error from PublishDirectory: %v\n", err)
	}
	if expectedErr == nil {
		s.NoError(err)

		s.Equal(12, len(emitter.Events))
		s.Equal("publish/start", emitter.Events[0].Type)
		s.Equal("publish/createNewDeployment/start", emitter.Events[1].Type)
		s.Equal("publish/createNewDeployment/success", emitter.Events[2].Type)
		s.Equal("publish/getRPackageDescriptions/start", emitter.Events[3].Type)
		s.Equal("publish/getRPackageDescriptions/success", emitter.Events[4].Type)
		s.Equal("publish/createBundle/start", emitter.Events[5].Type)
		s.Equal("publish/createBundle/success", emitter.Events[6].Type)
		s.Equal("publish/deployContent/start", emitter.Events[7].Type)
		s.Equal("publish/uploadBundle/start", emitter.Events[8].Type)
		s.Equal("publish/uploadBundle/success", emitter.Events[9].Type)
		s.Equal("publish/deployContent/success", emitter.Events[10].Type)
		s.Equal("publish/success", emitter.Events[11].Type)
	} else {
		s.NotNil(err)
		s.Equal(expectedErr.Error(), err.Error())
	}

	// Verify deployment record
	if options.expectContentID {
		recordPath := deployment.GetDeploymentPath(stateStore.Dir, recordName)
		record, err := deployment.FromFile(recordPath)
		s.NoError(err)

		// Verify the record has the right content ID
		s.Equal(myContentID, record.ID)

		// Verify client version
		s.Equal(project.Version, record.ClientVersion)

		// Verify timestamps
		s.NotEqual("", record.DeployedAt)

		// Verify config name
		s.Equal("myConfig", record.ConfigName)
		s.NotNil(record.Configuration)

		// Verify URLs
		s.Contains(record.DashboardURL, string(myContentID))
		s.Contains(record.DirectURL, string(myContentID))

		// Check files are recorded if upload was successful
		if errsMock.uploadErr == nil && errsMock.rPackageErr == nil {
			s.Contains(record.Files, "app.py")
			s.Contains(record.Files, "requirements.txt")
			s.Equal([]string{"flask"}, record.Requirements)
			s.Contains(record.Renv.Packages, renv.PackageName("mypkg"))
		}
	}

	// Check we don't have bad deployment record
	badPath := deployment.GetDeploymentPath(stateStore.Dir, "")
	exists, err := badPath.Exists()
	s.NoError(err)
	s.False(exists)
}
