package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"

	"github.com/r3labs/sse/v2"
)

type SSEServer interface {
	Close()
	CreateStream(id string) *sse.Stream
	RemoveStream(id string)
	StreamExists(id string) bool
	Publish(id string, event *sse.Event)
	TryPublish(id string, event *sse.Event) bool
}

type SSEEmitter struct {
	server SSEServer
}

func NewSSEEmitter(server SSEServer) *SSEEmitter {
	return &SSEEmitter{
		server: server,
	}
}

func (e *SSEEmitter) EmitEvent(event *AgentEvent) error {
	eventJSON, err := json.Marshal(event)
	if err != nil {
		return err
	}
	e.server.Publish("messages",
		&sse.Event{
			Data:  eventJSON,
			Event: []byte("message"),
		},
	)
	return nil
}
