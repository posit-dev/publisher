package events

// Copyright (C) 2023 by Posit Software, PBC.

type CapturingEmitter struct {
	Events []*Event
}

func NewCapturingEmitter() *CapturingEmitter {
	return &CapturingEmitter{
		Events: make([]*Event, 0),
	}
}

func (c *CapturingEmitter) Emit(event *Event) error {
	c.Events = append(c.Events, event)
	return nil
}
