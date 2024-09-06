package connect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"time"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

type ConnectContent struct {
	Name                           types.ContentName `json:"name"`
	Title                          string            `json:"title,omitempty"`
	Description                    string            `json:"description,omitempty"`
	AccessType                     string            `json:"access_type,omitempty"`
	ConnectionTimeout              *int32            `json:"connection_timeout,omitempty"`
	ReadTimeout                    *int32            `json:"read_timeout,omitempty"`
	InitTimeout                    *int32            `json:"init_timeout,omitempty"`
	IdleTimeout                    *int32            `json:"idle_timeout,omitempty"`
	MaxProcesses                   *int32            `json:"max_processes,omitempty"`
	MinProcesses                   *int32            `json:"min_processes,omitempty"`
	MaxConnsPerProcess             *int32            `json:"max_conns_per_process,omitempty"`
	LoadFactor                     *float64          `json:"load_factor,omitempty"`
	RunAs                          string            `json:"run_as,omitempty"`
	RunAsCurrentUser               *bool             `json:"run_as_current_user,omitempty"`
	MemoryRequest                  *int64            `json:"memory_request,omitempty"`
	MemoryLimit                    *int64            `json:"memory_limit,omitempty"`
	CPURequest                     *float64          `json:"cpu_request,omitempty"`
	CPULimit                       *float64          `json:"cpu_limit,omitempty"`
	AMDGPULimit                    *int64            `json:"amd_gpu_limit,omitempty"`
	NvidiaGPULimit                 *int64            `json:"nvidia_gpu_limit,omitempty"`
	ServiceAccountName             string            `json:"service_account_name,omitempty"`
	DefaultImageName               string            `json:"default_image_name,omitempty"`
	DefaultREnvironmentManagement  *bool             `json:"default_r_environment_management,omitempty"`
	DefaultPyEnvironmentManagement *bool             `json:"default_py_environment_management,omitempty"`
}

type ConnectContentSummary struct {
	GUID            types.ContentID    `json:"guid"`
	Name            types.ContentName  `json:"name"`
	Title           string             `json:"title,omitempty"`
	Created         types.Time         `json:"created_time"`
	LastDeployed    types.Time         `json:"last_deployed_time"`
	BundleId        types.NullInt64Str `json:"bundle_id"`
	AppMode         AppMode            `json:"app_mode"`
	ContentCategory string             `json:"content_category"`
	DashboardURL    string             `json:"dashboard_url"`
	Role            string             `json:"app_role"`
	OwnerGUID       types.GUID         `json:"owner_guid"`
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
	if cfg.Access != nil {
		// access types map directly to Connect
		c.AccessType = string(cfg.Access.Type)
	}
	if cfg.Connect != nil {
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

func ConnectContentSummaryFromServer(account *accounts.Account, log logging.Logger) ([]*ConnectContentSummary, error) {
	client, err := NewConnectClient(account, 30*time.Second, events.NewNullEmitter(), log)
	if err != nil {
		return nil, err
	}
	contentItems, err := client.GetContent(log)
	if err != nil {
		return nil, err
	}
	count := 0
	for _, content := range *contentItems {
		if content.Role == "owner" || content.Role == "editor" {
			count += 1
		}
	}
	summary := make([]*ConnectContentSummary, count)
	nextIndex := 0
	for _, content := range *contentItems {
		if content.Role == "owner" || content.Role == "editor" {
			s := &ConnectContentSummary{
				GUID:            content.GUID,
				Name:            content.Name,
				Created:         content.Created,
				LastDeployed:    content.LastDeployed,
				AppMode:         content.AppMode,
				ContentCategory: content.ContentCategory,
				DashboardURL:    content.DashboardURL,
				Role:            content.Role,
				OwnerGUID:       content.OwnerGUID,
			}
			title, set := content.Title.Get()
			if set {
				s.Title = title
			}
			valid := content.BundleId.Valid()
			if valid {
				s.BundleId = content.BundleId
			}
			summary[nextIndex] = s
			nextIndex += 1
		}
	}
	return summary, nil
}
