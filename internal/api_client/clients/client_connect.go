package clients

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/apptypes"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util"
)

type ConnectClient struct {
	client  HTTPClient
	account *accounts.Account
	log     logging.Logger
}

func NewConnectClient(
	account *accounts.Account,
	timeout time.Duration,
	log logging.Logger) (*ConnectClient, error) {

	httpClient, err := NewDefaultHTTPClient(account, timeout, log)
	if err != nil {
		return nil, err
	}
	return &ConnectClient{
		client:  httpClient,
		account: account,
		log:     log,
	}, nil
}

func (c *ConnectClient) TestConnection() error {
	// Make a client without auth so we're just testing the connection.
	c.log.Info("Testing connection", "url", c.account.URL)
	acctWithoutAuth := *(c.account)
	acctWithoutAuth.AuthType = accounts.AuthTypeNone
	client, err := newHTTPClientForAccount(&acctWithoutAuth, 30*time.Second, c.log)
	if err != nil {
		return err
	}
	testURL := util.URLJoin(c.account.URL, "/__api__/server_settings")
	resp, err := client.Get(testURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return fmt.Errorf("the server '%s' does not appear to be a Connect server", c.account.URL)
	} else if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected response from Connect server: %s", resp.Status)
	}
	return nil
}

type UserDTO struct {
	Email       string         `json:"email"`
	Username    string         `json:"username"`
	FirstName   string         `json:"first_name"`
	LastName    string         `json:"last_name"`
	UserRole    string         `json:"user_role"`
	CreatedTime types.Time     `json:"created_time"`
	UpdatedTime types.Time     `json:"updated_time"`
	ActiveTime  types.NullTime `json:"active_time"`
	Confirmed   bool           `json:"confirmed"`
	Locked      bool           `json:"locked"`
	GUID        types.UserID   `json:"guid"`
}

func (u *UserDTO) toUser() *User {
	return &User{
		Id:        u.GUID,
		Username:  u.Username,
		FirstName: u.FirstName,
		LastName:  u.LastName,
		Email:     u.Email,
	}
}

func (c *ConnectClient) TestAuthentication() (*User, error) {
	c.log.Info("Testing authentication", "method", c.account.AuthType.Description(), "url", c.account.URL)
	var connectUser UserDTO
	err := c.client.Get("/__api__/v1/user", &connectUser)
	if err != nil {
		return nil, err
	}
	if connectUser.Locked {
		return nil, fmt.Errorf("user account %s is locked", connectUser.Username)
	}
	if !connectUser.Confirmed {
		return nil, fmt.Errorf("user account %s is not confirmed", connectUser.Username)
	}
	if !(connectUser.UserRole == "publisher" || connectUser.UserRole == "administrator") {
		return nil, fmt.Errorf("user account %s with role '%s' does not have permission to publish content", connectUser.Username, connectUser.UserRole)
	}
	return connectUser.toUser(), nil
}

type connectGetContentDTO struct {
	GUID               types.ContentID    `json:"guid"`
	Name               types.ContentName  `json:"name"`
	Title              types.NullString   `json:"title"`
	Description        string             `json:"description"`
	AccessType         string             `json:"access_type"`
	ConnectionTimeout  types.NullInt32    `json:"connection_timeout"`
	ReadTimeout        types.NullInt32    `json:"read_timeout"`
	InitTimeout        types.NullInt32    `json:"init_timeout"`
	IdleTimeout        types.NullInt32    `json:"idle_timeout"`
	MaxProcesses       types.NullInt32    `json:"max_processes"`
	MinProcesses       types.NullInt32    `json:"min_processes"`
	MaxConnsPerProcess types.NullInt32    `json:"max_conns_per_process"`
	LoadFactor         types.NullFloat64  `json:"load_factor"`
	Created            types.Time         `json:"created_time"`
	LastDeployed       types.Time         `json:"last_deployed_time"`
	BundleId           types.NullInt64Str `json:"bundle_id"`
	AppMode            apptypes.AppMode   `json:"app_mode"`
	ContentCategory    string             `json:"content_category"`
	Parameterized      bool               `json:"parameterized"`
	ClusterName        types.NullString   `json:"cluster_name"`
	ImageName          types.NullString   `json:"image_name"`
	RVersion           types.NullString   `json:"r_version"`
	PyVersion          types.NullString   `json:"py_version"`
	QuartoVersion      types.NullString   `json:"quarto_version"`
	RunAs              types.NullString   `json:"run_as"`
	RunAsCurrentUser   bool               `json:"run_as_current_user"`
	OwnerGUID          types.GUID         `json:"owner_guid"`
	ContentURL         string             `json:"content_url"`
	DashboardURL       string             `json:"dashboard_url"`
	Role               string             `json:"app_role"`
	Id                 types.Int64Str     `json:"id"`
	// Tags         []tagOutputDTO    `json:"tags,omitempty"`
	// Owner        *ownerOutputDTO   `json:"owner,omitempty"`
}

func (c *ConnectClient) CreateDeployment(body *state.ConnectContent) (types.ContentID, error) {
	content := connectGetContentDTO{}
	err := c.client.Post("/__api__/v1/content", body, &content)
	if err != nil {
		return "", err
	}
	return content.GUID, nil
}

func (c *ConnectClient) UpdateDeployment(contentID types.ContentID, body *state.ConnectContent) error {
	url := fmt.Sprintf("/__api__/v1/content/%s", contentID)
	return c.client.Patch(url, body, nil)
}

type connectEnvVar struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

func (c *ConnectClient) SetEnvVars(contentID types.ContentID, env config.Environment) error {
	body := make([]connectEnvVar, 0, len(env))
	for name, value := range env {
		body = append(body, connectEnvVar{
			Name:  name,
			Value: value,
		})
	}
	url := fmt.Sprintf("/__api__/v1/content/%s/environment", contentID)
	return c.client.Patch(url, body, nil)
}

type bundleMetadataDTO struct {
	BundleSource       types.NullString `json:"source"`
	BundleSourceRepo   types.NullString `json:"source_repo"`
	BundleSourceBranch types.NullString `json:"source_branch"`
	BundleSourceCommit types.NullString `json:"source_commit"`
	BundleArchiveMD5   types.NullString `json:"archive_md5"`
	BundleArchiveSHA1  types.NullString `json:"archive_sha1"`
}

type connectGetBundleDTO struct {
	Id            types.BundleID    `json:"id"`
	ContentGUID   types.ContentID   `json:"content_guid"`
	Created       time.Time         `json:"created_time"`
	ClusterName   types.NullString  `json:"cluster_name"`
	ImageName     types.NullString  `json:"image_name"`
	RVersion      types.NullString  `json:"r_version"`
	PyVersion     types.NullString  `json:"py_version"`
	QuartoVersion types.NullString  `json:"quarto_version"`
	Active        bool              `json:"active"`
	Size          int64             `json:"size"`
	Metadata      bundleMetadataDTO `json:"metadata"`
}

func (c *ConnectClient) UploadBundle(contentID types.ContentID, body io.Reader) (types.BundleID, error) {
	url := fmt.Sprintf("/__api__/v1/content/%s/bundles", contentID)
	resp, err := c.client.PostRaw(url, body, "application/gzip")
	if err != nil {
		return "", err
	}
	bundle := connectGetBundleDTO{}
	err = json.Unmarshal(resp, &bundle)
	if err != nil {
		return "", err
	}
	return bundle.Id, nil
}

type deployInputDTO struct {
	BundleID types.BundleID `json:"bundle_id"`
}

type deployOutputDTO struct {
	TaskID types.TaskID `json:"task_id"`
}

func (c *ConnectClient) DeployBundle(contentId types.ContentID, bundleId types.BundleID) (types.TaskID, error) {
	body := deployInputDTO{
		BundleID: bundleId,
	}
	url := fmt.Sprintf("/__api__/v1/content/%s/deploy", contentId)
	output := deployOutputDTO{}
	err := c.client.Post(url, body, &output)
	if err != nil {
		return "", err
	}
	return output.TaskID, nil
}

// From Connect's api/v1/tasks/dto.go
type taskDTO struct {
	Id       types.TaskID `json:"id"`
	Output   []string     `json:"output"`
	Result   any          `json:"result"`
	Finished bool         `json:"finished"`
	Code     int32        `json:"code"`
	Error    string       `json:"error"`
	Last     int32        `json:"last"`
}

func (c *ConnectClient) getTask(taskID types.TaskID, previous *taskDTO) (*taskDTO, error) {
	var task taskDTO
	var firstLine int32
	if previous != nil {
		firstLine = previous.Last
	}
	url := fmt.Sprintf("/__api__/v1/tasks/%s?first=%d", taskID, firstLine)
	err := c.client.Get(url, &task)
	if err != nil {
		return nil, err
	}
	return &task, nil
}

var buildRPattern = regexp.MustCompile("Building (Shiny application|Plumber API|R Markdown document).*")
var buildPythonPattern = regexp.MustCompile("Building (.* application|.* API|Jupyter notebook).*")
var launchPattern = regexp.MustCompile("Launching .* (application|API|notebook)")
var staticPattern = regexp.MustCompile("(Building|Launching) static content")

func eventOpFromLogLine(currentOp events.Operation, line string) events.Operation {
	match := buildRPattern.MatchString(line)
	if match || strings.Contains(line, "Bundle created with R version") {
		return events.PublishRestoreREnvOp
	}
	match = buildPythonPattern.MatchString(line)
	if match || strings.Contains(line, "Bundle requested Python version") {
		return events.PublishRestorePythonEnvOp
	}
	match = launchPattern.MatchString(line)
	if match {
		return events.PublishRunContentOp
	}
	match = staticPattern.MatchString(line)
	if match {
		return events.PublishRunContentOp
	}
	return currentOp
}

type packageRuntime string

const (
	rRuntime      packageRuntime = "r"
	pythonRuntime packageRuntime = "python"
)

type packageStatus string

const (
	downloadAndInstallPackage packageStatus = "download+install"
	downloadPackage           packageStatus = "download"
	installPackage            packageStatus = "install"
)

var rPackagePattern = regexp.MustCompile(`Installing ([[:word:]\.]+) \((\S+)\) ...`)
var pythonCollectingPackagePattern = regexp.MustCompile(`Collecting (\S+)==(\S+)`)
var pythonInstallingPackagePattern = regexp.MustCompile(`Found existing installation: (\S+) ()\S+`)

type packageEvent struct {
	runtime packageRuntime
	status  packageStatus
	name    string
	version string
}

func makePackageEvent(match []string, rt packageRuntime, status packageStatus) *packageEvent {
	return &packageEvent{
		runtime: rt,
		status:  status,
		name:    match[1],
		version: match[2],
	}
}

func packageEventFromLogLine(line string) *packageEvent {
	if match := rPackagePattern.FindStringSubmatch(line); match != nil {
		return makePackageEvent(match, rRuntime, downloadAndInstallPackage)
	} else if match := pythonCollectingPackagePattern.FindStringSubmatch(line); match != nil {
		return makePackageEvent(match, pythonRuntime, downloadPackage)
	} else if match := pythonInstallingPackagePattern.FindStringSubmatch(line); match != nil {
		return makePackageEvent(match, pythonRuntime, installPackage)
	}
	return nil
}

func handleTaskUpdate(task *taskDTO, op types.Operation, log logging.Logger) (types.Operation, error) {
	var nextOp types.Operation

	for _, line := range task.Output {
		// Detect state transitions from certain matching log lines.
		nextOp = eventOpFromLogLine(op, line)
		if nextOp != op {
			if op != "" {
				log.Success("Done", logging.LogKeyOp, op)
			}
			op = nextOp
			log.Start(line, logging.LogKeyOp, op)
		} else {
			log.Info(line, logging.LogKeyOp, op)
		}

		// Log a progress event for certain matching log lines.
		event := packageEventFromLogLine(line)
		if event != nil {
			log.Status("Package restore",
				"runtime", event.runtime,
				"status", event.status,
				"name", event.name,
				"version", event.version,
				logging.LogKeyOp, op)
		}
	}
	if task.Finished {
		if task.Error != "" {
			// TODO: make these errors more specific, maybe by
			// using the Connect error codes from the logs.
			err := types.NewAgentError(events.DeploymentFailedCode, errors.New(task.Error), nil)
			err.SetOperation(op)
			return op, err
		}
		log.Success("Done", logging.LogKeyOp, op)
	}
	return op, nil
}

func (c *ConnectClient) WaitForTask(taskID types.TaskID, log logging.Logger) error {
	var previous *taskDTO
	var op events.Operation

	for {
		task, err := c.getTask(taskID, previous)
		if err != nil {
			return err
		}
		op, err = handleTaskUpdate(task, op, log)
		if err != nil || task.Finished {
			return err
		}
		previous = task
		time.Sleep(500 * time.Millisecond)
	}
}
