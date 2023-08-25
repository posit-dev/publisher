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

func (l Logger) Start(msg string, op EventOp) {
	l.Info(msg, LogKeyOp, op, LogKeyPhase, StartPhase)
}

func (l Logger) Success(msg string, op EventOp) {
	l.Info(msg, LogKeyOp, op, LogKeyPhase, SuccessPhase)
}

func (l Logger) Status(msg string, op EventOp) {
	l.Info(msg, LogKeyOp, op, LogKeyPhase, ProgressPhase)
}

func (l Logger) Progress(msg string, op EventOp, done float32, total float32) {
	l.Info(msg, LogKeyOp, op, LogKeyPhase, ProgressPhase, "done", done, "total", total)
}
