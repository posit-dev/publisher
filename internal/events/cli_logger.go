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

func NewSimpleLogger(verbosity int) logging.Logger {
	level := logLevel(verbosity)
	stderrHandler := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level})
	multiHandler := logging.NewMultiHandler(stderrHandler, NewCLIHandler())
	return logging.FromStdLogger(slog.New(multiHandler))
}

// CLIHandler is a logging handler that prints neatly formatted
// progress messages to stdout.
type CLIHandler struct {
	file  io.Writer
	attrs []slog.Attr
}

var _ slog.Handler = &CLIHandler{}

func NewCLIHandler() *CLIHandler {
	return &CLIHandler{
		file: os.Stdout,
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
		fmt.Fprintf(h.file, "%-35s", opName+"...")
	case logging.SuccessPhase:
		fmt.Fprintln(h.file, "[OK]")
	case logging.FailurePhase:
		fmt.Fprintln(h.file, "[ERROR]")
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
