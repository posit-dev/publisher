package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"time"

	"github.com/mitchellh/mapstructure"
	"github.com/rstudio/connect-client/internal/project"
	"github.com/rstudio/connect-client/internal/types"
)

type EventType = string
type EventData = types.ErrorData

var NoData = struct{}{}

type Event struct {
	Time time.Time
	Type EventType
	Data EventData

	op      Operation
	phase   Phase
	errCode ErrorCode
}

// We use Operation and Phase to construct the event Type.
type Operation = types.Operation

// Phase indicates which part of an Operation we are performing
type Phase string

const (
	StartPhase    Phase = "start"
	ProgressPhase Phase = "progress"
	StatusPhase   Phase = "status"
	SuccessPhase  Phase = "success"
	FailurePhase  Phase = "failure"
	LogPhase      Phase = "log"
)

const (
	AgentOp Operation = "agent"

	PublishCheckCapabilitiesOp   Operation = "publish/checkCapabilities"
	PublishCreateNewDeploymentOp Operation = "publish/createNewDeployment"
	PublishSetEnvVarsOp          Operation = "publish/setEnvVars"
	PublishCreateBundleOp        Operation = "publish/createBundle"
	PublishUpdateDeploymentOp    Operation = "publish/createDeployment"
	PublishUploadBundleOp        Operation = "publish/uploadBundle"
	PublishDeployBundleOp        Operation = "publish/deployBundle"
	PublishRestorePythonEnvOp    Operation = "publish/restorePythonEnv"
	PublishRestoreREnvOp         Operation = "publish/restoreREnv"
	PublishRunContentOp          Operation = "publish/runContent"
	PublishSetVanityUrlOp        Operation = "publish/setVanityURL"
	PublishValidateDeploymentOp  Operation = "publish/validateDeployment"
	PublishOp                    Operation = "publish"
)

func New(op Operation, phase Phase, errCode ErrorCode, data any) *Event {
	var eventData EventData
	err := mapstructure.Decode(data, &eventData)
	if err != nil {
		if project.DevelopmentBuild() {
			panic(err)
		}
	}
	return &Event{
		Time:    time.Now(),
		Type:    EventTypeOf(op, phase),
		Data:    eventData,
		op:      op,
		phase:   phase,
		errCode: errCode,
	}
}

func EventTypeOf(op Operation, phase Phase) EventType {
	return fmt.Sprintf("%s/%s", op, phase)
}
