package events

import "maps"

// Copyright (C) 2023 by Posit Software, PBC.

type dataEmitter struct {
	data    EventData
	emitter Emitter
}

func NewDataEmitter(data EventData, emitter Emitter) *dataEmitter {
	return &dataEmitter{
		data:    data,
		emitter: emitter,
	}
}

func (e *dataEmitter) Emit(event *Event) error {
	// Add our data to every emitted event.
	if event.Data == nil {
		event.Data = make(EventData)
	}
	maps.Copy(event.Data, e.data)
	return e.emitter.Emit(event)
}
