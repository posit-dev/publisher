package clients

import (
	"connect-client/accounts"
	"connect-client/util"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

// Copyright (C) 2023 by Posit Software, PBC.

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
	Email       string    `json:"email"`
	Username    string    `json:"username"`
	FirstName   string    `json:"first_name"`
	LastName    string    `json:"last_name"`
	UserRole    string    `json:"user_role"`
	CreatedTime time.Time `json:"created_time"`
	UpdatedTime time.Time `json:"updated_time"`
	ActiveTime  time.Time `json:"active_time"`
	Confirmed   bool      `json:"confirmed"`
	Locked      bool      `json:"locked"`
	GUID        string    `json:"guid"`
}

func (c *ConnectClient) TestAuthentication() error {
	c.logger.Infof("Testing %s authentication to %s", c.account.AuthType.Description(), c.account.URL)
	var user UserDTO
	err := c.get("/__api__/v1/user", &user)
	if err != nil {
		return err
	}
	fmt.Printf("%s (%s %s) [%s]\n", user.Username, user.FirstName, user.LastName, user.GUID)
	return nil
}

func (c *ConnectClient) CreateDeployment() (ContentID, error) {
	// TODO
	return "", nil
}

func (c *ConnectClient) DeployBundle(ContentID, io.Reader) (BundleID, TaskID, error) {
	// TODO
	return "", "", nil
}

// From Connect's api/v1/tasks/dto.go
type taskOutputDTO struct {
	Id       string      `json:"id"`
	Output   []string    `json:"output"`
	Result   interface{} `json:"result"`
	Finished bool        `json:"finished"`
	Code     int32       `json:"code"`
	Error    string      `json:"error"`
	Last     int32       `json:"last"`
}

func (c *ConnectClient) GetTask(taskID TaskID) (*Task, error) {
	var task taskOutputDTO
	err := c.get(fmt.Sprintf("/__api__/v1/tasks/%s", taskID), &task)
	if err != nil {
		return nil, err
	}
	return &Task{
		Finished: task.Finished,
		Output:   task.Output,
		Error:    task.Error,
	}, nil
}
