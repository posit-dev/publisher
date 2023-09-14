package logging

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"log/slog"

	"github.com/rstudio/connect-client/internal/types"
)

// Phase indicates which part of an Operation we are performing
type Phase string

const (
	StartPhase    Phase = "start"
	ProgressPhase Phase = "progress"
	SuccessPhase  Phase = "success"
	FailurePhase  Phase = "failure"
	LogPhase      Phase = "log"
)

// Special attribute keys for use in logging.
// LogKeyOp should be followed by an Operation,
// and LogKeyPhase should be followed by a Phase.
const (
	LogKeyOp      = "event_op"
	LogKeyPhase   = "event_phase"
	LogKeyErrCode = "error_code"
)

type Logger interface {
	BaseLogger
	Start(msg string, args ...any)
	Success(msg string, args ...any)
	Status(msg string, args ...any)
	Progress(msg string, done float32, total float32, args ...any)
	Failure(err error)
	WithArgs(args ...any) Logger
}

type logger struct {
	BaseLogger
}

func New() Logger {
	return logger{
		slog.Default(),
	}
}

func FromStdLogger(log *slog.Logger) Logger {
	return logger{log}
}

func (l logger) Start(msg string, args ...any) {
	l.Info(msg, append([]any{LogKeyPhase, StartPhase}, args...)...)
}

func (l logger) Success(msg string, args ...any) {
	l.Info(msg, append([]any{LogKeyPhase, SuccessPhase}, args...)...)
}

func (l logger) Status(msg string, args ...any) {
	l.Info(msg, append([]any{LogKeyPhase, ProgressPhase}, args...)...)
}

func (l logger) Progress(msg string, done float32, total float32, args ...any) {
	l.Info(msg, append([]any{LogKeyPhase, ProgressPhase, "done", done, "total", total}, args...)...)
}

func (l logger) Failure(err error) {
	if agentError, ok := err.(types.EventableError); ok {
		args := []any{
			LogKeyOp, agentError.GetOperation(),
			LogKeyPhase, FailurePhase,
			LogKeyErrCode, agentError.GetCode(),
		}
		for k, v := range agentError.GetData() {
			args = append(args, k, v)
		}
		l.Error(err.Error(), args...)
	} else {
		// We shouldn't get here, because callers who use Failure
		// (the Publish routine) will wrap all errors in AgentErrors.
		// But just in case, log it anyway.
		l.Debug("Received a non-eventable error in LoggerImpl.Failure; see the following error entry")
		l.Error(err.Error(), LogKeyPhase, FailurePhase)
	}
}

func (l logger) WithArgs(args ...any) Logger {
	return logger{l.BaseLogger.With(args...)}
}
