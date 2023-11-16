package config

import (
	"github.com/rstudio/connect-client/internal/apptypes"
)

// Copyright (C) 2023 by Posit Software, PBC.

type Config struct {
	Schema        SchemaURL        `toml:"$schema"`
	Type          apptypes.AppMode `toml:"type"`
	Entrypoint    string           `toml:"string"`
	Title         string           `toml:"title,omitempty"`
	Description   string           `toml:"description,multiline,omitempty"`
	ThumbnailFile string           `toml:"thumbnail,omitempty"`
	Tags          []string         `toml:"tags,omitempty"`
	Python        Python           `toml:"python,omitempty"`
	R             R                `toml:"r,omitempty"`
	Quarto        Quarto           `toml:"quarto,omitempty"`
	Environment   Environment      `toml:"environment,omitempty"`
	Secrets       []string         `toml:"secrets,omitempty"`
	Schedules     []Schedule       `toml:"schedules,omitempty"`
	Access        Access           `toml:"access,omitempty"`
	Connect       Connect          `toml:"connect,omitempty"`
}

type SchemaURL string

type Environment = map[string]string

type Python struct {
	Version        string `toml:"version"`
	PackageFile    string `toml:"package-file"`
	PackageManager string `toml:"package-manager"`
}

type R struct {
	Version        string `toml:"version"`
	PackageFile    string `toml:"package-file"`
	PackageManager string `toml:"package-manager"`
}

type Quarto struct {
	Version string   `toml:"version"`
	Engines []string `toml:"engines"`
}

type Schedule struct {
	Start      string `toml:"start"`
	Recurrence string `toml:"recurrence"`
}

type AccessType string

const (
	AccessTypeAnonymous AccessType = "all"
	AccessTypeLoggedIn  AccessType = "logged-in"
	AccessTypeACL       AccessType = "acl"
)

type Access struct {
	Type   AccessType `toml:"type"`
	Users  []User     `toml:"users,omitempty"`
	Groups []Group    `toml:"groups,omitempty"`
}

type User struct {
	Id          string `toml:"id,omitempty"`
	GUID        string `toml:"guid,omitempty"`
	Name        string `toml:"name,omitempty"`
	Permissions string `toml:"permissions"`
}

type Group struct {
	Id          string `toml:"id,omitempty"`
	GUID        string `toml:"guid,omitempty"`
	Name        string `toml:"name,omitempty"`
	Permissions string `toml:"permissions"`
}

type Connect struct {
	Access     ConnectAccess     `toml:"access,omitempty"`
	Runtime    ConnectRuntime    `toml:"runtime,omitempty"`
	Kubernetes ConnectKubernetes `toml:"kubernetes,omitempty"`
}

type ConnectAccess struct {
	RunAs            string `toml:"run-as,omitempty"`
	RunAsCurrentUser *bool  `toml:"run-as-current-user,omitempty"`
}

type ConnectRuntime struct {
	ConnectionTimeout  *int32   `toml:"connection-timeout,omitempty"`
	ReadTimeout        *int32   `toml:"read-timeout,omitempty"`
	InitTimeout        *int32   `toml:"init-timeout,omitempty"`
	IdleTimeout        *int32   `toml:"idle-timeout,omitempty"`
	MaxProcesses       *int32   `toml:"max-processes,omitempty"`
	MinProcesses       *int32   `toml:"min-processes,omitempty"`
	MaxConnsPerProcess *int32   `toml:"max-connections,omitempty"`
	LoadFactor         *float64 `toml:"load-factor,omitempty"`
}

type ConnectKubernetes struct {
	MemoryRequest      *int64   `toml:"memory-request,omitempty"`
	MemoryLimit        *int64   `toml:"memory-limit,omitempty"`
	CPURequest         *float64 `toml:"cpu-request,omitempty"`
	CPULimit           *float64 `toml:"cpu-limit,omitempty"`
	AMDGPULimit        *int64   `toml:"amd-gpu-limit,omitempty"`
	NvidiaGPULimit     *int64   `toml:"nvidia-gpu-limit,omitempty"`
	ServiceAccountName string   `toml:"service-account-name,omitempty"`
	DefaultImageName   string   `toml:"image-name,omitempty"`
}
