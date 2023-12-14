package events

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"slices"

	"github.com/rstudio/connect-client/internal/logging"
)

func NewStructuredLogger(verbosity int) logging.Logger {
	level := logLevel(verbosity)
	stderrHandler := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level})
	return logging.FromStdLogger(slog.New(stderrHandler))
}

type structuredLogWriter struct {
	writer      io.Writer
	NeedNewline bool
}

func newStructuredLogWriter(w io.Writer) *structuredLogWriter {
	return &structuredLogWriter{
		writer: w,
	}
}

func (w *structuredLogWriter) Write(p []byte) (n int, err error) {
	if w.NeedNewline {
		fmt.Fprintln(w.writer)
		w.NeedNewline = false
	}
	return w.writer.Write(p)
}

func NewSimpleLogger(verbosity int, w io.Writer) logging.Logger {
	level := logLevel(verbosity)
	writer := newStructuredLogWriter(w)
	stderrHandler := slog.NewTextHandler(writer, &slog.HandlerOptions{Level: level})
	cliHandler := NewCLIHandler(writer)
	multiHandler := logging.NewMultiHandler(stderrHandler, cliHandler)
	return logging.FromStdLogger(slog.New(multiHandler))
}

// CLIHandler is a logging handler that prints neatly formatted
// progress messages to stdout.
type CLIHandler struct {
	writer *structuredLogWriter
	attrs  []slog.Attr
}

var _ slog.Handler = &CLIHandler{}

func NewCLIHandler(w *structuredLogWriter) *CLIHandler {
	return &CLIHandler{
		writer: w,
	}
}

func (h *CLIHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return true
}

var opNameMap = map[Operation]string{
	PublishCheckCapabilitiesOp:   "Checking server capabilities",
	PublishCreateNewDeploymentOp: "Creating deployment",
	PublishSetEnvVarsOp:          "Setting environment variables",
	PublishCreateBundleOp:        "Preparing file archive",
	PublishUpdateDeploymentOp:    "Updating deployment settings",
	PublishUploadBundleOp:        "Uploading files",
	PublishDeployBundleOp:        "Initiating deployment",
	PublishRestorePythonEnvOp:    "Restoring Python environment",
	PublishRestoreREnvOp:         "Restoring R environment",
	PublishRunContentOp:          "Executing deployed content",
	PublishSetVanityUrlOp:        "Setting custom URL",
	PublishValidateDeploymentOp:  "Validating deployment",
}

func (h *CLIHandler) Handle(ctx context.Context, rec slog.Record) error {
	op := AgentOp
	phase := logging.LogPhase

	handleAttr := func(attr slog.Attr) bool {
		switch attr.Key {
		case logging.LogKeyOp:
			op = Operation(attr.Value.String())
		case logging.LogKeyPhase:
			phase = Phase(attr.Value.String())
		}
		return true
	}
	// First handle any attributes attached to this handler
	for _, attr := range h.attrs {
		handleAttr(attr)
	}
	// Then the ones from this specific message.
	rec.Attrs(handleAttr)

	opName, ok := opNameMap[op]
	if !ok {
		return nil
	}
	switch phase {
	case logging.StartPhase:
		fmt.Fprintf(h.writer, "%-35s", opName+"...")
		h.writer.NeedNewline = true
	case logging.SuccessPhase:
		h.writer.NeedNewline = false
		fmt.Fprintln(h.writer, "[OK]")
	case logging.FailurePhase:
		h.writer.NeedNewline = false
		fmt.Fprintln(h.writer, "[ERROR]")
	}
	return nil
}

func (h *CLIHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	newH := *h
	newH.attrs = append(slices.Clip(newH.attrs), attrs...)
	return &newH
}

func (h *CLIHandler) WithGroup(string) slog.Handler {
	// This handler doesn't support groups.
	return h
}
