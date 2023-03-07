package clients

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"connect-client/accounts"
	"connect-client/apitypes"
	"connect-client/util"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

type ConnectClient struct {
	*HTTPClient
	account *accounts.Account
	logger  rslog.Logger
}

func NewConnectClient(
	account *accounts.Account,
	timeout time.Duration,
	logger rslog.Logger) (APIClient, error) {

	httpClient, err := NewHTTPClient(account, timeout, logger)
	if err != nil {
		return nil, err
	}
	return &ConnectClient{
		HTTPClient: httpClient,
		account:    account,
		logger:     logger,
	}, nil
}

func (c *ConnectClient) TestConnection() error {
	// Make a client without auth so we're just testing the connection.
	c.logger.Infof("Testing connection to %s", c.account.URL)
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
		return fmt.Errorf("The server '%s' does not appear to be a Connect server.", c.account.URL)
	} else if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Unexpected response from Connect server: %s", resp.Status)
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
	GUID        UserID            `json:"guid"`
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
	c.logger.Infof("Testing %s authentication to %s", c.account.AuthType.Description(), c.account.URL)
	var connectUser UserDTO
	err := c.get("/__api__/v1/user", &connectUser)
	if err != nil {
		return nil, err
	}
	if connectUser.Locked {
		return nil, fmt.Errorf("User account %s is locked.", connectUser.Username)
	}
	if !connectUser.Confirmed {
		return nil, fmt.Errorf("User account %s is not confirmed.", connectUser.Username)
	}
	if !(connectUser.UserRole == "publisher" || connectUser.UserRole == "administrator") {
		return nil, fmt.Errorf("User account %s with role '%s' does not have permission to publish content.", connectUser.Username, connectUser.UserRole)
	}
	return connectUser.toUser(), nil
}

type connectCreateContentDTO struct {
	Name        ContentName         `json:"name"`
	Title       apitypes.NullString `json:"title"`
	Description string              `json:"description"`
}

type connectGetContentDTO struct {
	GUID               ContentID             `json:"guid"`
	Name               ContentName           `json:"name"`
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
	AppMode            string                `json:"app_mode"`
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

func (c *ConnectClient) CreateDeployment(name ContentName, title apitypes.NullString) (ContentID, error) {
	body := connectCreateContentDTO{
		Name:  name,
		Title: title,
	}
	content := connectGetContentDTO{}
	err := c.post("/__api__/v1/content", &body, &content)
	if err != nil {
		return "", err
	}
	return content.GUID, nil
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
	Id            BundleID            `json:"id"`
	ContentGUID   ContentID           `json:"content_guid"`
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

func (c *ConnectClient) UploadBundle(contentID ContentID, body io.Reader) (BundleID, error) {
	url := fmt.Sprintf("/__api__/v1/content/%s/bundles", contentID)
	resp, err := c.postRaw(url, body, "application/gzip")
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
	BundleID BundleID `json:"bundle_id"`
}

type deployOutputDTO struct {
	TaskID TaskID `json:"task_id"`
}

func (c *ConnectClient) DeployBundle(contentId ContentID, bundleId BundleID) (TaskID, error) {
	body := deployInputDTO{
		BundleID: bundleId,
	}
	url := fmt.Sprintf("/__api__/v1/content/%s/deploy", contentId)
	output := deployOutputDTO{}
	err := c.post(url, body, &output)
	if err != nil {
		return "", err
	}
	return output.TaskID, nil
}

// From Connect's api/v1/tasks/dto.go
type taskOutputDTO struct {
	Id       TaskID   `json:"id"`
	Output   []string `json:"output"`
	Result   any      `json:"result"`
	Finished bool     `json:"finished"`
	Code     int32    `json:"code"`
	Error    string   `json:"error"`
	Last     int32    `json:"last"`
}

func (task *taskOutputDTO) ToTask() *Task {
	return &Task{
		Finished:   task.Finished,
		Output:     task.Output,
		Error:      task.Error,
		TotalLines: task.Last,
	}
}

func (c *ConnectClient) GetTask(taskID TaskID, previous *Task) (*Task, error) {
	var connectTask taskOutputDTO
	var firstLine int32
	if previous != nil {
		firstLine = previous.TotalLines
	}
	url := fmt.Sprintf("/__api__/v1/tasks/%s?first=%d", taskID, firstLine)
	err := c.get(url, &connectTask)
	if err != nil {
		return nil, err
	}
	return connectTask.ToTask(), nil
}
