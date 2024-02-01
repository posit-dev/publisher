package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"strings"
	"time"

	"github.com/mitchellh/mapstructure"
	"github.com/rstudio/connect-client/internal/project"
	"github.com/rstudio/connect-client/internal/types"
)

type EventType = string
type EventData = types.ErrorData

type Event struct {
	Time time.Time
	Type EventType
	Data EventData
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
	err := mapstructure.Decode(data, eventData)
	if err != nil {
		if project.DevelopmentBuild() {
			panic(err)
		}
	}
	return &Event{
		Time: time.Now(),
		Type: EventTypeOf(op, phase, errCode),
		Data: eventData,
	}
}

func EventTypeOf(op Operation, phase Phase, errCode ErrorCode) EventType {
	if phase == FailurePhase && errCode != "" {
		return fmt.Sprintf("%s/%s/%s", op, phase, errCode)
	} else {
		return fmt.Sprintf("%s/%s", op, phase)
	}
}

func SplitEventType(t EventType) (Operation, Phase, ErrorCode) {
	s := strings.SplitN(t, "/", 3)
	if len(s) == 3 {
		return Operation(s[0]), Phase(s[1]), ErrorCode(s[2])
	} else if len(s) == 2 {
		return Operation(s[0]), Phase(s[1]), ErrorCode("")
	} else {
		// Should not happen
		return Operation(s[0]), Phase(""), ErrorCode("")
	}
}
