package events

// Copyright (C) 2023 by Posit Software, PBC.

type Emitter interface {
	Emit(*Event) error
}
