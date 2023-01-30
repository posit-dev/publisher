package rslog

// Copyright (C) 2022 by RStudio, PBC.

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

type LogOutputType string

const (
	LogOutputStdout LogOutputType = "STDOUT"
	LogOutputFile   LogOutputType = "FILE"
	LogOutputStderr LogOutputType = "STDERR"

	// We will use this output type only internally.
	// We need to know when the default option comes from an empty configuration
	// or when the user sets to our default option (stdout)
	LogOutputDefault LogOutputType = "DEFAULT"
)

type LogCategory string

func (c LogCategory) Text() string {
	text := fmt.Sprintf("%v Logs", c)
	return strings.Title(strings.ToLower(text))
}

func (t *LogOutputType) UnmarshalText(text []byte) (err error) {
	values := []LogOutputType{
		LogOutputStdout,
		LogOutputFile,
		LogOutputStderr,
	}

	for _, currentValue := range values {
		if strings.EqualFold(string(text), string(currentValue)) {
			*t = currentValue
			return nil
		}
	}

	return fmt.Errorf("invalid LogOutputType value '%s'. Allowed values are %v", text, values)
}

type FileSystem interface {
	Stat(path string) (os.FileInfo, error)
	MkdirAll(path string, perm os.FileMode) error
	OpenFile(name string, flag int, perm os.FileMode) (io.Writer, error)
	Stdout() io.Writer
	Stderr() io.Writer
}

func NewOSFileSystem() FileSystem {
	return osFileSystem{}
}

type osFileSystem struct{}

func (o osFileSystem) MkdirAll(path string, perm os.FileMode) error {
	return os.MkdirAll(path, perm)
}

func (o osFileSystem) Stat(path string) (os.FileInfo, error) {
	return os.Stat(path)
}

func (o osFileSystem) OpenFile(name string, flag int, perm os.FileMode) (io.Writer, error) {
	return os.OpenFile(name, flag, perm)
}

func (o osFileSystem) Stderr() io.Writer {
	return os.Stderr
}

func (o osFileSystem) Stdout() io.Writer {
	return os.Stdout
}

type OutputDest struct {
	Output      LogOutputType
	Filepath    string
	DefaultFile string
}

type OutputBuilder interface {
	Build(outputs ...OutputDest) (io.Writer, error)
}

type outputBuilder struct {
	logCategory LogCategory
	fileSystem  FileSystem
	defaultFile string
}

func NewOutputLogBuilder(logCategory LogCategory, defaultFile string) OutputBuilder {
	return outputBuilder{
		logCategory: logCategory,
		fileSystem:  NewOSFileSystem(),
		defaultFile: defaultFile,
	}
}

func (b outputBuilder) Build(outputs ...OutputDest) (io.Writer, error) {
	var writers []io.Writer

	for _, output := range outputs {
		w, err := b.build(output.Output, output.Filepath)
		if err != nil {
			return nil, err
		}

		writers = append(writers, w)
	}

	return io.MultiWriter(writers...), nil
}

func (b outputBuilder) build(output LogOutputType, logFilePath string) (io.Writer, error) {
	switch output {
	case LogOutputDefault, LogOutputStderr:
		return b.fileSystem.Stderr(), nil
	case LogOutputStdout:
		return b.fileSystem.Stdout(), nil
	case LogOutputFile:
		return b.resolveLogFile(logFilePath)
	default:
		err := fmt.Errorf("The output %q provided for the logging output configuration field isn't supported.", output)
		return nil, err
	}
}

func (b outputBuilder) resolveLogFile(logFilePath string) (io.Writer, error) {
	lgr := DefaultLogger()
	if strings.TrimSpace(logFilePath) == "" {
		lgr.Warnf("Logging output is set to FILE, but no path was provided.")
		return b.fallbackOutput()
	}

	loggingDir := filepath.Dir(logFilePath)
	if _, err := b.fileSystem.Stat(loggingDir); os.IsNotExist(err) {
		// Destination directory should already exist
		return nil, fmt.Errorf("The specified logs destination directory %q does not exist.", loggingDir)
	}

	writer, err := b.fileSystem.OpenFile(logFilePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		// Fallback to default logging file if needed
		lgr.Errorf("Not possible to open the logging file %q. Error: %v.", logFilePath, err)
		return b.fallbackOutput()
	}

	lgr.Infof("Using file %s to store %s.", logFilePath, b.logCategory.Text())
	return writer, err
}

func (b outputBuilder) fallbackOutput() (io.Writer, error) {
	lgr := DefaultLogger()
	lgr.Infof("Attempting to use default logging file %q", b.defaultFile)
	writer, err := b.fileSystem.OpenFile(b.defaultFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		err = fmt.Errorf(`Not possible to open the default logging file %s. Error: %v.`, b.defaultFile, err)
		return nil, err
	}
	return writer, nil
}

type discardOutputBuilder struct{}

func (b discardOutputBuilder) Build(_ ...OutputDest) (io.Writer, error) {
	return io.Discard, nil
}

type StderrOutputBuilder struct{}

func (StderrOutputBuilder) Build(_ ...OutputDest) (io.Writer, error) {
	return os.Stderr, nil
}
