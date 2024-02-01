package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"strings"
	"time"

	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/types"
)

type EventType = string
type EventData = types.ErrorData

type AgentEvent struct {
	Time time.Time
	Type EventType
	Data EventData
}

// We use Operation and Phase to construct the event Type.
type Operation = types.Operation
type Phase = logging.Phase

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

func EventTypeOf(op Operation, phase Phase, errCode ErrorCode) EventType {
	if phase == logging.FailurePhase && errCode != "" {
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
