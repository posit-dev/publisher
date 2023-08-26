package events

import (
	"log/slog"
	"os"

	"github.com/r3labs/sse/v2"
	"github.com/rstudio/connect-client/internal/util"
)

type Logger struct {
	*slog.Logger
}

func DefaultLogger() Logger {
	return Logger{
		slog.Default(),
	}
}

func NewLogger(level slog.Leveler, sseServer *sse.Server) Logger {
	stderrHandler := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level})
	if sseServer != nil {
		sseHandler := NewSSEHandler(sseServer, &SSEHandlerOptions{Level: level})
		multiHandler := util.NewMultiHandler(stderrHandler, sseHandler)
		return Logger{slog.New(multiHandler)}
	} else {
		return Logger{slog.New(stderrHandler)}
	}
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
	if agentError, ok := err.(EventableError); ok {
		l.Error(err.Error(), LogKeyOp, agentError.GetOperation(), LogKeyPhase, FailurePhase)
	} else {
		// We shouldn't get here, because callers who use Failure
		// (the Publish routine) will wrap all errors in AgentErrors.
		// But just in case, log it anyway.
		l.Debug("Received a non-eventable error in Logger.Failure; see the following error entry")
		l.Error(err.Error(), LogKeyPhase, FailurePhase)
	}
}

func (l Logger) With(args ...any) Logger {
	return Logger{l.Logger.With(args...)}
}
