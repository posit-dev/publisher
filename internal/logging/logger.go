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

type Logger struct {
	BaseLogger
}

func DefaultLogger() Logger {
	return Logger{
		slog.Default(),
	}
}

func FromStdLogger(logger *slog.Logger) Logger {
	return Logger{logger}
}

func (l Logger) Start(msg string, args ...any) {
	l.Info(msg, append([]any{LogKeyPhase, StartPhase}, args...)...)
}

func (l Logger) Success(msg string, args ...any) {
	l.Info(msg, append([]any{LogKeyPhase, SuccessPhase}, args...)...)
}

func (l Logger) Status(msg string, args ...any) {
	l.Info(msg, append([]any{LogKeyPhase, ProgressPhase}, args...)...)
}

func (l Logger) Progress(msg string, done float32, total float32, args ...any) {
	l.Info(msg, append([]any{LogKeyPhase, ProgressPhase, "done", done, "total", total}, args...)...)
}

func (l Logger) Failure(err error) {
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
		l.Debug("Received a non-eventable error in Logger.Failure; see the following error entry")
		l.Error(err.Error(), LogKeyPhase, FailurePhase)
	}
}

func (l Logger) With(args ...any) Logger {
	return Logger{l.BaseLogger.With(args...)}
}
