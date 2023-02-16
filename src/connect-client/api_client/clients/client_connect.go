package clients

import (
	"connect-client/accounts"
	"connect-client/util"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

// Copyright (C) 2023 by Posit Software, PBC.

type ConnectClient struct {
	account accounts.Account
	client  *http.Client
	logger  rslog.Logger
}

func NewConnectClient(
	account accounts.Account,
	timeout time.Duration,
	logger rslog.Logger) (APIClient, error) {

	httpClient, err := newHTTPClientForAccount(account, timeout, logger)
	if err != nil {
		return nil, err
	}
	return &ConnectClient{
		account: account,
		client:  httpClient,
		logger:  logger,
	}, nil
}

var errNotAConnectServer = errors.New("The target server does not appear to be a Connect server.")
var errAuthenticationFailed = errors.New("Unable to log in with the provided credentials.")

func (c *ConnectClient) TestConnection() error {
	// Make a client without auth so we're just testing the connection.
	acctWithoutAuth := c.account
	acctWithoutAuth.AuthType = accounts.AuthTypeNone
	client, err := newHTTPClientForAccount(acctWithoutAuth, 30*time.Second, c.logger)
	if err != nil {
		return err
	}
	testURL := util.URLPathJoin(c.account.URL, "/__api__/server_settings")
	resp, err := client.Get(testURL)
	if err != nil {
		return err
	}
	if resp.StatusCode == http.StatusNotFound {
		return errNotAConnectServer
	} else if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Unexpected response from Connect server: %s", resp.Status)
	}
	return nil
}

func (c *ConnectClient) TestAuthentication() error {
	testURL := util.URLPathJoin(c.account.URL, "/__api__/me")
	resp, err := c.client.Get(testURL)
	if err != nil {
		return err
	}
	if resp.StatusCode == http.StatusUnauthorized {
		return errAuthenticationFailed
	} else if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Unexpected response from Connect server: %s", resp.Status)
	}
	return nil
}

func (c *ConnectClient) get(path string) ([]byte, error) {
	apiURL := util.URLPathJoin(c.account.URL, path)
	resp, err := c.client.Get(apiURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, errAuthenticationFailed
	} else if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Unexpected response from Connect server: %s", resp.Status)
	}
	return io.ReadAll(resp.Body)
}

func (c *ConnectClient) CreateDeployment() (ContentID, error) {

}

func (c *ConnectClient) DeployBundle(ContentID, io.Reader) (BundleID, TaskID, error) {

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
	body, err := c.get(fmt.Sprintf("/__api__/v1/tasks/%s", taskID))
	if err != nil {
		return nil, err
	}
	// Connect tasks are a superset of the
	var task taskOutputDTO
	err = json.Unmarshal(body, &task)
	if err != nil {
		return nil, err
	}
	return &Task{
		Finished: task.Finished,
		Output:   task.Output,
		Error:    task.Error,
	}, nil
}
