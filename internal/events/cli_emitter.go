package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"io"
	"strings"

	"github.com/rstudio/connect-client/internal/logging"
)

type cliEmitter struct {
	writer *structuredLogWriter
}

func NewCliEmitter(w io.Writer, log logging.Logger) *cliEmitter {
	return &cliEmitter{
		writer: newStructuredLogWriter(w),
	}
}

var opNameMap = map[Operation]string{
	PublishCheckCapabilitiesOp:   "Check Configuration",
	PublishCreateNewDeploymentOp: "Create New Deployment",
	PublishSetEnvVarsOp:          "Set environment variables",
	PublishCreateBundleOp:        "Prepare Files",
	PublishUploadBundleOp:        "Upload Files",
	PublishUpdateDeploymentOp:    "Update Deployment Settings",
	PublishDeployBundleOp:        "Activate Deployment",
	PublishRestorePythonEnvOp:    "Restore Python environment",
	PublishRestoreREnvOp:         "Restore R environment",
	PublishRunContentOp:          "Run Content",
	PublishSetVanityUrlOp:        "Set Custom URL",
	PublishValidateDeploymentOp:  "Test Deployment",
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

func formatEventData(data EventData) string {
	if len(data) == 0 {
		return ""
	}
	var b strings.Builder
	needSeparator := false

	for k, v := range data {
		if needSeparator {
			b.WriteString(", ")
		} else {
			needSeparator = true
		}
		fmt.Fprintf(&b, "%s=%q", k, v)
	}
	result := b.String()
	if result == "" {
		return ""
	}
	return fmt.Sprintf("(%s)", result)
}

func (e *cliEmitter) Emit(event *Event) error {
	opName, ok := opNameMap[event.op]
	if !ok {
		// Skip Operations we don't handle, like PublishOp
		return nil
	}
	switch event.phase {
	case StartPhase:
		fmt.Fprintf(e.writer, "%-35s", opName+"...")
		e.writer.NeedNewline = true
	case SuccessPhase:
		e.writer.NeedNewline = false
		fmt.Fprintln(e.writer, "[OK]", formatEventData(event.Data))
	case FailurePhase:
		e.writer.NeedNewline = false
		fmt.Fprintln(e.writer, "[ERROR]", event.errCode, formatEventData(event.Data))
	}
	return nil
}
