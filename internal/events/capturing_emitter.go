package events

// Copyright (C) 2023 by Posit Software, PBC.

type capturingEmitter struct {
	Events []*Event
}

func NewCapturingEmitter() *capturingEmitter {
	return &capturingEmitter{
		Events: make([]*Event, 0),
	}
}

func (c *capturingEmitter) Emit(event *Event) error {
	c.Events = append(c.Events, event)
	return nil
}
