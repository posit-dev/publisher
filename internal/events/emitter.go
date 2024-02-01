package events

// Copyright (C) 2023 by Posit Software, PBC.

type EventEmitter interface {
	EmitEvent(*AgentEvent) error
}
