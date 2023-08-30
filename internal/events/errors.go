package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"time"

	"github.com/rstudio/connect-client/internal/types"
)

type ErrorCode = types.ErrorCode

func ErrorToEvent(e types.EventableError) AgentEvent {
	return AgentEvent{
		Time: time.Now().UTC(),
		Type: fmt.Sprintf("%s/failure/%s", e.GetOperation(), e.GetCode()),
		Data: EventData(e.GetData()),
	}
}
