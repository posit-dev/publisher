package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"slices"

	"github.com/r3labs/sse/v2"
)

type SSEHandlerOptions struct {
	Level slog.Leveler
}

type SSEHandler struct {
	opts   SSEHandlerOptions
	server *sse.Server
	attrs  []slog.Attr
}

func NewSSEHandler(server *sse.Server, opts *SSEHandlerOptions) slog.Handler {
	h := &SSEHandler{
		server: server,
	}
	if opts != nil {
		h.opts = *opts
	}
	if h.opts.Level == nil {
		h.opts.Level = slog.LevelInfo
	}
	return h
}

func (h *SSEHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return level >= h.opts.Level.Level()
}

type LogKey string

const (
	LogKeyOp    = "event_op"
	LogKeyPhase = "event_phase"
)

func (h *SSEHandler) recordToEvent(rec slog.Record) *AgentEvent {
	event := &AgentEvent{
		Time: rec.Time,
		Data: make(EventData),
	}
	event.Data["Message"] = rec.Message
	event.Data["Level"] = rec.Level.String()

	// Convert the logged attributes into a map in the event Data.
	// Also recognize the "op" and "phase" attributes as the context
	// to use in the event "Type" field, e.g.
	// log.Info("a message", "op", "publish/restore")
	// will create an SSE event with Type: "publish/restore/log".
	op := OpAgent
	phase := LogPhase

	handleAttr := func(attr slog.Attr) bool {
		switch attr.Key {
		case LogKeyOp:
			op = EventOp(attr.Value.String())
		case LogKeyPhase:
			phase = EventPhase(attr.Value.String())
		case "": // skip empty attrs
		default:
			event.Data[attr.Key] = attr.Value.Any()
		}
		return true
	}
	// First handle any attributes attached to this handler
	for _, attr := range h.attrs {
		handleAttr(attr)
	}
	// Then the ones from this specific message.
	rec.Attrs(handleAttr)
	event.Type = EventTypeOf(op, phase)
	return event
}

func (h *SSEHandler) Handle(ctx context.Context, rec slog.Record) error {
	event := h.recordToEvent(rec)
	eventJSON, err := json.Marshal(event)
	if err != nil {
		return err
	}

	// TODO: debugging
	fmt.Println("SSE would send: ", string(eventJSON))
	return nil

	h.server.Publish("messages",
		&sse.Event{
			Data:  eventJSON,
			Event: []byte("message"),
		},
	)
	return nil
}

func (h *SSEHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	newH := *h
	newH.attrs = append(slices.Clip(newH.attrs), attrs...)
	return &newH
}

func (h *SSEHandler) WithGroup(string) slog.Handler {
	// This handler doesn't support groups.
	return h
}
