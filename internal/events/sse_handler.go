package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"slices"

	"github.com/r3labs/sse/v2"
	"github.com/rstudio/publishing-client/internal/logging"
	"github.com/rstudio/publishing-client/internal/types"
)

type SSEServer interface {
	Close()
	CreateStream(id string) *sse.Stream
	RemoveStream(id string)
	StreamExists(id string) bool
	Publish(id string, event *sse.Event)
	TryPublish(id string, event *sse.Event) bool
}

type SSEHandlerOptions struct {
	Level slog.Leveler
}

type SSEHandler struct {
	opts   SSEHandlerOptions
	server SSEServer
	attrs  []slog.Attr
}

var _ slog.Handler = &SSEHandler{}

func NewSSEHandler(server SSEServer, opts *SSEHandlerOptions) *SSEHandler {
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
	op := AgentOp
	phase := logging.LogPhase
	errCode := types.UnknownErrorCode

	handleAttr := func(attr slog.Attr) bool {
		switch attr.Key {
		case logging.LogKeyOp:
			op = Operation(attr.Value.String())
		case logging.LogKeyPhase:
			phase = Phase(attr.Value.String())
		case logging.LogKeyErrCode:
			errCode = ErrorCode(attr.Value.String())
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
	event.Type = EventTypeOf(op, phase, errCode)
	return event
}

func (h *SSEHandler) Handle(ctx context.Context, rec slog.Record) error {
	event := h.recordToEvent(rec)
	eventJSON, err := json.Marshal(event)
	if err != nil {
		return err
	}

	// TODO: debugging
	fmt.Println("SSE will send: ", string(eventJSON))

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
