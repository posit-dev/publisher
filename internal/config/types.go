package config

import (
	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/apptypes"
	"github.com/rstudio/connect-client/internal/types"
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

type Deployment struct {
	Schema            SchemaURL           `toml:"$schema"`
	ServerType        accounts.ServerType `toml:"server-type"`
	ServerURL         string              `toml:"server-url"`
	Id                types.ContentID     `toml:"id"`
	ConfigurationFile string              `toml:"configuration-file"`
	Files             []string            `toml:"files"`
	Configuration     Config              `toml:"configuration"`
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

func (r *ConnectRuntime) SetConnectionTimeout(value int32) {
	r.ConnectionTimeout = &value
}
func (r *ConnectRuntime) SetReadTimeout(value int32) {
	r.ReadTimeout = &value
}
func (r *ConnectRuntime) SetInitTimeout(value int32) {
	r.InitTimeout = &value
}
func (r *ConnectRuntime) SetIdleTimeout(value int32) {
	r.IdleTimeout = &value
}
func (r *ConnectRuntime) SetMaxProcesses(value int32) {
	r.MaxProcesses = &value
}
func (r *ConnectRuntime) SetMinProcesses(value int32) {
	r.MinProcesses = &value
}
func (r *ConnectRuntime) SetMaxConnsPerProcess(value int32) {
	r.MaxConnsPerProcess = &value
}
func (r *ConnectRuntime) SetLoadFactor(value float64) {
	r.LoadFactor = &value
}

func (k *ConnectKubernetes) SetMemoryRequest(value int64) {
	k.MemoryRequest = &value
}
func (k *ConnectKubernetes) SetMemoryLimit(value int64) {
	k.MemoryLimit = &value
}
func (k *ConnectKubernetes) SetCPURequest(value float64) {
	k.CPURequest = &value
}
func (k *ConnectKubernetes) SetCPULimit(value float64) {
	k.CPULimit = &value
}
func (k *ConnectKubernetes) SetAMDGPULimit(value int64) {
	k.AMDGPULimit = &value
}
func (k *ConnectKubernetes) SetNvidiaGPULimit(value int64) {
	k.NvidiaGPULimit = &value
}
