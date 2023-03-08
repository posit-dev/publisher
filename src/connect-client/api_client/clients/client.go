package clients

import (
	"connect-client/apitypes"
	"fmt"
	"io"
	"time"
)

// Copyright (C) 2023 by Posit Software, PBC.

type ContentName string
type ContentID string
type BundleID string
type TaskID string
type UserID string

// Simplified user structure common to all servers
type User struct {
	Id        UserID
	Username  string
	FirstName string
	LastName  string
	Email     string
}

// Simplified task structure common to all servers
type Task struct {
	Finished   bool
	Output     []string
	Error      string
	TotalLines int32
}

type APIClient interface {
	TestConnection() error
	TestAuthentication() (*User, error)
	CreateDeployment(name ContentName, title apitypes.NullString) (ContentID, error)
	UploadBundle(ContentID, io.Reader) (BundleID, error)
	DeployBundle(ContentID, BundleID) (TaskID, error)
	GetTask(TaskID, *Task) (*Task, error)
}

// PublishingClient provides higher-level client methods that work
// on any type of publishing server, using the APIClient to abstract
// any details of specific server types.
type PublishingClient struct {
	APIClient
}

func (client *PublishingClient) WaitForTask(taskID TaskID, logWriter io.Writer) error {
	var previous *Task
	for {
		task, err := client.GetTask(taskID, previous)
		if err != nil {
			return err
		}
		for _, line := range task.Output {
			_, err = fmt.Fprintln(logWriter, line)
			if err != nil {
				return err
			}
		}
		if task.Finished {
			if task.Error != "" {
				return fmt.Errorf("Error from the server: %s", task.Error)
			}
			return nil
		}
		time.Sleep(1.0)
	}
}
