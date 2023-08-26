package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"time"
)

type EventType = string
type EventData map[string]any

type AgentEvent struct {
	Time time.Time
	Type EventType
	Data EventData
}

type Phase string
type Operation string

const (
	StartPhase    Phase = "start"
	ProgressPhase Phase = "progress"
	SuccessPhase  Phase = "success"
	FailurePhase  Phase = "failure"
	LogPhase      Phase = "log"
)

const (
	AgentOp Operation = "agent"

	PublishCreateDeploymentOp Operation = "publish/createDeployment"
	PublishCreateBundleOp     Operation = "publish/createBundle"
	PublishUploadBundleOp     Operation = "publish/uploadBundle"
	PublishDeployBundleOp     Operation = "publish/deployBundle"
	PublishRestorePythonEnvOp Operation = "publish/restorePythonEnv"
	PublishRestoreREnvOp      Operation = "publish/restoreREnv"
	PublishRunContentOp       Operation = "publish/runContent"
	PublishSetVanityUrlOp     Operation = "publish/setVanityURL"
)

func EventTypeOf(op Operation, phase Phase) EventType {
	return fmt.Sprintf("%s/%s", op, phase)
}
