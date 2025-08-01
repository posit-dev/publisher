package connect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"

	clienttypes "github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/types"
)

type ConnectContent struct {
	AppMode                        clienttypes.AppMode `json:"app_mode,omitempty"`
	Name                           types.ContentName   `json:"name"`
	Title                          string              `json:"title,omitempty"`
	GUID                           string              `json:"guid,omitempty"`
	Description                    string              `json:"description,omitempty"`
	AccessType                     string              `json:"access_type,omitempty"`
	ConnectionTimeout              *int32              `json:"connection_timeout,omitempty"`
	ReadTimeout                    *int32              `json:"read_timeout,omitempty"`
	InitTimeout                    *int32              `json:"init_timeout,omitempty"`
	IdleTimeout                    *int32              `json:"idle_timeout,omitempty"`
	MaxProcesses                   *int32              `json:"max_processes,omitempty"`
	MinProcesses                   *int32              `json:"min_processes,omitempty"`
	MaxConnsPerProcess             *int32              `json:"max_conns_per_process,omitempty"`
	LoadFactor                     *float64            `json:"load_factor,omitempty"`
	RunAs                          string              `json:"run_as,omitempty"`
	RunAsCurrentUser               *bool               `json:"run_as_current_user,omitempty"`
	MemoryRequest                  *int64              `json:"memory_request,omitempty"`
	MemoryLimit                    *int64              `json:"memory_limit,omitempty"`
	CPURequest                     *float64            `json:"cpu_request,omitempty"`
	CPULimit                       *float64            `json:"cpu_limit,omitempty"`
	AMDGPULimit                    *int64              `json:"amd_gpu_limit,omitempty"`
	NvidiaGPULimit                 *int64              `json:"nvidia_gpu_limit,omitempty"`
	ServiceAccountName             string              `json:"service_account_name,omitempty"`
	DefaultImageName               string              `json:"default_image_name,omitempty"`
	DefaultREnvironmentManagement  *bool               `json:"default_r_environment_management,omitempty"`
	DefaultPyEnvironmentManagement *bool               `json:"default_py_environment_management,omitempty"`
	Locked                         bool                `json:"locked,omitempty"`
}

// Returns and error if content is locked
func (c *ConnectContent) LockedError() error {
	if c.Locked {
		return fmt.Errorf("content with ID %s is locked", c.GUID)
	}
	return nil
}

func copy[T any](src *T) *T {
	if src == nil {
		return nil
	}
	dest := new(T)
	*dest = *src
	return dest
}

func ConnectContentFromConfig(cfg *config.Config) *ConnectContent {
	c := &ConnectContent{
		Name:        "",
		Title:       cfg.Title,
		Description: cfg.Description,
	}
	if cfg.Connect != nil {
		if cfg.Connect.AccessControl != nil {
			// access types map directly to Connect
			c.AccessType = string(cfg.Connect.AccessControl.Type)
		}
		if cfg.Connect.Runtime != nil {
			c.ConnectionTimeout = copy(cfg.Connect.Runtime.ConnectionTimeout)
			c.ReadTimeout = copy(cfg.Connect.Runtime.ReadTimeout)
			c.InitTimeout = copy(cfg.Connect.Runtime.InitTimeout)
			c.IdleTimeout = copy(cfg.Connect.Runtime.IdleTimeout)
			c.MaxProcesses = copy(cfg.Connect.Runtime.MaxProcesses)
			c.MinProcesses = copy(cfg.Connect.Runtime.MinProcesses)
			c.MaxConnsPerProcess = copy(cfg.Connect.Runtime.MaxConnsPerProcess)
			c.LoadFactor = copy(cfg.Connect.Runtime.LoadFactor)
		}
		if cfg.Connect.Access != nil {
			c.RunAs = cfg.Connect.Access.RunAs
			c.RunAsCurrentUser = copy(cfg.Connect.Access.RunAsCurrentUser)
		}
		if cfg.Connect.Kubernetes != nil {
			c.MemoryRequest = copy(cfg.Connect.Kubernetes.MemoryRequest)
			c.MemoryLimit = copy(cfg.Connect.Kubernetes.MemoryLimit)
			c.CPURequest = copy(cfg.Connect.Kubernetes.CPURequest)
			c.CPULimit = copy(cfg.Connect.Kubernetes.CPULimit)
			c.AMDGPULimit = copy(cfg.Connect.Kubernetes.AMDGPULimit)
			c.NvidiaGPULimit = copy(cfg.Connect.Kubernetes.NvidiaGPULimit)
			c.ServiceAccountName = cfg.Connect.Kubernetes.ServiceAccountName
			c.DefaultImageName = cfg.Connect.Kubernetes.DefaultImageName
			c.DefaultREnvironmentManagement = copy(cfg.Connect.Kubernetes.DefaultREnvironmentManagement)
			c.DefaultPyEnvironmentManagement = copy(cfg.Connect.Kubernetes.DefaultPyEnvironmentManagement)
		}
	}
	return c
}
