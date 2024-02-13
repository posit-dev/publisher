package events

// Copyright (C) 2023 by Posit Software, PBC.

type nullEmitter struct{}

func NewNullEmitter() *nullEmitter {
	return &nullEmitter{}
}

func (e *nullEmitter) Emit(event *Event) error {
	return nil
}
