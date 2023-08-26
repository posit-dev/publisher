package clients

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"time"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/apitypes"
	"github.com/rstudio/connect-client/internal/apptypes"
	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util"
)

type ConnectClient struct {
	client  HTTPClient
	account *accounts.Account
	logger  events.Logger
}

func NewConnectClient(
	account *accounts.Account,
	timeout time.Duration,
	log events.Logger) (*ConnectClient, error) {

	httpClient, err := NewDefaultHTTPClient(account, timeout, log)
	if err != nil {
		return nil, err
	}
	return &ConnectClient{
		client:  httpClient,
		account: account,
		logger:  log,
	}, nil
}

func (c *ConnectClient) TestConnection() error {
	// Make a client without auth so we're just testing the connection.
	c.logger.Info("Testing connection", "url", c.account.URL)
	acctWithoutAuth := *(c.account)
	acctWithoutAuth.AuthType = accounts.AuthTypeNone
	client, err := newHTTPClientForAccount(&acctWithoutAuth, 30*time.Second, c.logger)
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
	Email       string            `json:"email"`
	Username    string            `json:"username"`
	FirstName   string            `json:"first_name"`
	LastName    string            `json:"last_name"`
	UserRole    string            `json:"user_role"`
	CreatedTime apitypes.Time     `json:"created_time"`
	UpdatedTime apitypes.Time     `json:"updated_time"`
	ActiveTime  apitypes.NullTime `json:"active_time"`
	Confirmed   bool              `json:"confirmed"`
	Locked      bool              `json:"locked"`
	GUID        apitypes.UserID   `json:"guid"`
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
	c.logger.Info("Testing authentication", "method", c.account.AuthType.Description(), "url", c.account.URL)
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
	GUID               apitypes.ContentID    `json:"guid"`
	Name               apitypes.ContentName  `json:"name"`
	Title              apitypes.NullString   `json:"title"`
	Description        string                `json:"description"`
	AccessType         string                `json:"access_type"`
	ConnectionTimeout  apitypes.NullInt32    `json:"connection_timeout"`
	ReadTimeout        apitypes.NullInt32    `json:"read_timeout"`
	InitTimeout        apitypes.NullInt32    `json:"init_timeout"`
	IdleTimeout        apitypes.NullInt32    `json:"idle_timeout"`
	MaxProcesses       apitypes.NullInt32    `json:"max_processes"`
	MinProcesses       apitypes.NullInt32    `json:"min_processes"`
	MaxConnsPerProcess apitypes.NullInt32    `json:"max_conns_per_process"`
	LoadFactor         apitypes.NullFloat64  `json:"load_factor"`
	Created            apitypes.Time         `json:"created_time"`
	LastDeployed       apitypes.Time         `json:"last_deployed_time"`
	BundleId           apitypes.NullInt64Str `json:"bundle_id"`
	AppMode            apptypes.AppMode      `json:"app_mode"`
	ContentCategory    string                `json:"content_category"`
	Parameterized      bool                  `json:"parameterized"`
	ClusterName        apitypes.NullString   `json:"cluster_name"`
	ImageName          apitypes.NullString   `json:"image_name"`
	RVersion           apitypes.NullString   `json:"r_version"`
	PyVersion          apitypes.NullString   `json:"py_version"`
	QuartoVersion      apitypes.NullString   `json:"quarto_version"`
	RunAs              apitypes.NullString   `json:"run_as"`
	RunAsCurrentUser   bool                  `json:"run_as_current_user"`
	OwnerGUID          apitypes.GUID         `json:"owner_guid"`
	ContentURL         string                `json:"content_url"`
	DashboardURL       string                `json:"dashboard_url"`
	Role               string                `json:"app_role"`
	Id                 apitypes.Int64Str     `json:"id"`
	// Tags         []tagOutputDTO    `json:"tags,omitempty"`
	// Owner        *ownerOutputDTO   `json:"owner,omitempty"`
}

func (c *ConnectClient) CreateDeployment(body state.ConnectContent) (apitypes.ContentID, error) {
	content := connectGetContentDTO{}
	err := c.client.Post("/__api__/v1/content", &body, &content)
	if err != nil {
		return "", err
	}
	return content.GUID, nil
}

func (c *ConnectClient) UpdateDeployment(contentID apitypes.ContentID, body state.ConnectContent) error {
	url := fmt.Sprintf("/__api__/v1/content/%s", contentID)
	return c.client.Patch(url, &body, nil)
}

type bundleMetadataDTO struct {
	BundleSource       apitypes.NullString `json:"source"`
	BundleSourceRepo   apitypes.NullString `json:"source_repo"`
	BundleSourceBranch apitypes.NullString `json:"source_branch"`
	BundleSourceCommit apitypes.NullString `json:"source_commit"`
	BundleArchiveMD5   apitypes.NullString `json:"archive_md5"`
	BundleArchiveSHA1  apitypes.NullString `json:"archive_sha1"`
}

type connectGetBundleDTO struct {
	Id            apitypes.BundleID   `json:"id"`
	ContentGUID   apitypes.ContentID  `json:"content_guid"`
	Created       time.Time           `json:"created_time"`
	ClusterName   apitypes.NullString `json:"cluster_name"`
	ImageName     apitypes.NullString `json:"image_name"`
	RVersion      apitypes.NullString `json:"r_version"`
	PyVersion     apitypes.NullString `json:"py_version"`
	QuartoVersion apitypes.NullString `json:"quarto_version"`
	Active        bool                `json:"active"`
	Size          int64               `json:"size"`
	Metadata      bundleMetadataDTO   `json:"metadata"`
}

func (c *ConnectClient) UploadBundle(contentID apitypes.ContentID, body io.Reader) (apitypes.BundleID, error) {
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
	BundleID apitypes.BundleID `json:"bundle_id"`
}

type deployOutputDTO struct {
	TaskID apitypes.TaskID `json:"task_id"`
}

func (c *ConnectClient) DeployBundle(contentId apitypes.ContentID, bundleId apitypes.BundleID) (apitypes.TaskID, error) {
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
	Id       apitypes.TaskID `json:"id"`
	Output   []string        `json:"output"`
	Result   any             `json:"result"`
	Finished bool            `json:"finished"`
	Code     int32           `json:"code"`
	Error    string          `json:"error"`
	Last     int32           `json:"last"`
}

func (c *ConnectClient) getTask(taskID apitypes.TaskID, previous *taskDTO) (*taskDTO, error) {
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

func eventOpFromLogLine(currentOp events.EventOp, line string) events.EventOp {
	if match, _ := regexp.MatchString("Building (Shiny application|Plumber API).*", line); match {
		return events.OpPublishRestoreREnv
	} else if match, _ := regexp.MatchString("Building (.* application|.* API|Jupyter notebook).*", line); match {
		return events.OpPublishRestorePythonEnv
	} else if match, _ := regexp.MatchString("Launching .* (application|API|notebook)", line); match {
		return events.OpPublishRunContent
	} else if match, _ := regexp.MatchString("(Building|Launching) static content", line); match {
		return events.OpPublishRunContent
	}
	return currentOp
}

func (c *ConnectClient) WaitForTask(taskID apitypes.TaskID, log events.Logger) error {
	var previous *taskDTO
	var op events.EventOp

	for {
		task, err := c.getTask(taskID, previous)
		if err != nil {
			return err
		}
		for _, line := range task.Output {
			nextOp := eventOpFromLogLine(op, line)
			if nextOp != op {
				log.Success("Done")
				op = nextOp
				log = log.With(events.LogKeyOp, op)
			}
			log.Info(line, events.LogKeyOp, op)
		}
		if task.Finished {
			if task.Error != "" {
				// TODO: make these errors more specific, maybe by
				// using the Connect error codes from the logs.
				err := errors.New(task.Error)
				return events.NewAgentError(events.DeploymentFailedCode, err, nil)
			}
			return nil
		}
		previous = task
		time.Sleep(500 * time.Millisecond)
	}
}
