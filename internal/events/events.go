package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
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
	PublishCreateDeploymentOp    Operation = "publish/createDeployment"
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
