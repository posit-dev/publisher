package state

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/types"
)

type ConnectContent struct {
	Name               types.ContentName `json:"name"`
	Title              string            `json:"title,omitempty"`
	Description        string            `json:"description,omitempty"`
	AccessType         string            `json:"access_type,omitempty"`
	ConnectionTimeout  *int32            `json:"connection_timeout,omitempty"`
	ReadTimeout        *int32            `json:"read_timeout,omitempty"`
	InitTimeout        *int32            `json:"init_timeout,omitempty"`
	IdleTimeout        *int32            `json:"idle_timeout,omitempty"`
	MaxProcesses       *int32            `json:"max_processes,omitempty"`
	MinProcesses       *int32            `json:"min_processes,omitempty"`
	MaxConnsPerProcess *int32            `json:"max_conns_per_process,omitempty"`
	LoadFactor         *float64          `json:"load_factor,omitempty"`
	RunAs              string            `json:"run_as,omitempty"`
	RunAsCurrentUser   *bool             `json:"run_as_current_user,omitempty"`
	MemoryRequest      *int64            `json:"memory_request,omitempty"`
	MemoryLimit        *int64            `json:"memory_limit,omitempty"`
	CPURequest         *float64          `json:"cpu_request,omitempty"`
	CPULimit           *float64          `json:"cpu_limit,omitempty"`
	AMDGPULimit        *int64            `json:"amd_gpu_limit,omitempty"`
	NvidiaGPULimit     *int64            `json:"nvidia_gpu_limit,omitempty"`
	ServiceAccountName string            `json:"service_account_name,omitempty"`
	DefaultImageName   string            `json:"default_image_name,omitempty"`
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
	return &ConnectContent{
		Name:               "",
		Title:              cfg.Title,
		Description:        cfg.Description,
		AccessType:         string(cfg.Access.Type), // access types map directly to Connect
		ConnectionTimeout:  copy(cfg.Connect.Runtime.ConnectionTimeout),
		ReadTimeout:        copy(cfg.Connect.Runtime.ReadTimeout),
		InitTimeout:        copy(cfg.Connect.Runtime.InitTimeout),
		IdleTimeout:        copy(cfg.Connect.Runtime.IdleTimeout),
		MaxProcesses:       copy(cfg.Connect.Runtime.MaxProcesses),
		MinProcesses:       copy(cfg.Connect.Runtime.MinProcesses),
		MaxConnsPerProcess: copy(cfg.Connect.Runtime.MaxConnsPerProcess),
		LoadFactor:         copy(cfg.Connect.Runtime.LoadFactor),
		RunAs:              cfg.Connect.Access.RunAs,
		RunAsCurrentUser:   cfg.Connect.Access.RunAsCurrentUser,
		MemoryRequest:      copy(cfg.Connect.Kubernetes.MemoryRequest),
		MemoryLimit:        copy(cfg.Connect.Kubernetes.MemoryLimit),
		CPURequest:         copy(cfg.Connect.Kubernetes.CPURequest),
		CPULimit:           copy(cfg.Connect.Kubernetes.CPULimit),
		AMDGPULimit:        copy(cfg.Connect.Kubernetes.AMDGPULimit),
		NvidiaGPULimit:     copy(cfg.Connect.Kubernetes.NvidiaGPULimit),
		ServiceAccountName: cfg.Connect.Kubernetes.ServiceAccountName,
		DefaultImageName:   cfg.Connect.Kubernetes.DefaultImageName,
	}
}
