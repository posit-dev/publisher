package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"time"

	"github.com/posit-dev/publisher/internal/types"
)

type EventData = types.ErrorData

type Event struct {
	Time    time.Time
	Type    string
	Data    EventData
	ErrCode ErrorCode

	op    Operation
	phase Phase
}

type Operation = types.Operation

type Phase string

const (
	LogPhase Phase = "log"
)

const (
	AgentOp Operation = "agent"
)

func EventTypeOf(op Operation, phase Phase) string {
	return fmt.Sprintf("%s/%s", op, phase)
}
