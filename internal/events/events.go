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

type EventPhase string
type EventOp string

const (
	StartPhase    EventPhase = "start"
	ProgressPhase EventPhase = "progress"
	SuccessPhase  EventPhase = "success"
	FailurePhase  EventPhase = "failure"
	LogPhase      EventPhase = "log"
)

const (
	OpAgent EventOp = "agent"

	OpPublishCreateDeployment EventOp = "publish/createDeployment"
	OpPublishCreateBundle     EventOp = "publish/createBundle"
	OpPublishUploadBundle     EventOp = "publish/uploadBundle"
	OpPublishDeployBundle     EventOp = "publish/deployBundle"
	OpPublishRestorePythonEnv EventOp = "publish/restorePythonEnv"
	OpPublishRestoreREnv      EventOp = "publish/restoreREnv"
	OpPublishRunContent       EventOp = "publish/runContent"
	OpPublishSetVanityUrl     EventOp = "publish/setVanityURL"
)

func EventTypeOf(op EventOp, phase EventPhase) EventType {
	return fmt.Sprintf("%s/%s", op, phase)
}
