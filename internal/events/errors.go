package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"time"

	"github.com/rstudio/connect-client/internal/types"
)

func NewErrorEvent(e types.EventableError) Event {
	data := e.GetData()
	data["msg"] = e.Error()

	return Event{
		Time: time.Now(),
		Type: fmt.Sprintf("%s/failure/%s", e.GetOperation(), e.GetCode()),
		Data: data,
	}
}
