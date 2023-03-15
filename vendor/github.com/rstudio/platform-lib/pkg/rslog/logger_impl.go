package rslog

// Copyright (C) 2022 by RStudio, PBC.

import (
	"io"
	"sync"

	"github.com/sirupsen/logrus"
)

const (
	ServerLog LogCategory = "SERVER"
)

var DefaultLoggerFactory LoggerFactory

type LoggerFactoryImpl struct{}

func (f *LoggerFactoryImpl) DefaultLogger() Logger {
	// Ignoring error because it only can return error from the builder,
	// and the builder in use here with the LogOutputStdout option, doesn't return error
	lgr, _ := NewLoggerImpl(LoggerOptionsImpl{
		Output: []OutputDest{
			{
				LogOutputStdout,
				"",
				"",
			},
		},
		Format: TextFormat,
		Level:  InfoLevel,
	}, NewOutputLogBuilder(ServerLog, ""))

	return lgr
}

type TerminalLoggerFactory struct {
	LogLevel LogLevel
}

func (f *TerminalLoggerFactory) DefaultLogger() Logger {
	// Ignoring error because it only can return error from the builder, and the builder in use here, doesn't return error
	lgr, _ := NewLoggerImpl(LoggerOptionsImpl{
		Format: TextFormat,
		Level:  f.LogLevel,
	}, StderrOutputBuilder{})
	return lgr
}

type LoggerImpl struct {
	CoreLoggerImpl
	CoreLogger *logrus.Logger
	wrappers   map[*logrusEntryWrapper]struct{}
}

type LoggerOptionsImpl struct {
	Output []OutputDest
	Level  LogLevel
	Format OutputFormat
}

func NewLoggerImpl(options LoggerOptionsImpl,
	outputBuilder OutputBuilder,
) (*LoggerImpl, error) {

	l := logrus.New()

	writer, err := outputBuilder.Build(options.Output...)
	if err != nil {
		return nil, err
	}

	l.SetOutput(writer)
	l.SetFormatter(getFormatter(options.Format))
	l.SetLevel(getLevel(options.Level))

	return &LoggerImpl{
		CoreLogger:     l,
		CoreLoggerImpl: l,
	}, nil
}

//Formatters which enforce UTC timestamp representation

type UTCJSONFormatter struct {
	*logrus.JSONFormatter
}

func NewUTCJSONFormatter() *UTCJSONFormatter {
	return &UTCJSONFormatter{
		&logrus.JSONFormatter{
			TimestampFormat: "2006-01-02T15:04:05.000Z",
		},
	}
}

func (u *UTCJSONFormatter) Format(e *logrus.Entry) ([]byte, error) {
	e.Time = e.Time.UTC()
	return u.JSONFormatter.Format(e)
}

type UTCTextFormatter struct {
	*logrus.TextFormatter
}

func NewUTCTextFormatter() *UTCTextFormatter {
	return &UTCTextFormatter{
		&logrus.TextFormatter{
			FullTimestamp:          true,
			TimestampFormat:        "2006-01-02T15:04:05.000Z",
			DisableLevelTruncation: true,
		}}
}

func (u *UTCTextFormatter) Format(e *logrus.Entry) ([]byte, error) {
	e.Time = e.Time.UTC()
	return u.TextFormatter.Format(e)
}

func getFormatter(outputFormat OutputFormat) logrus.Formatter {
	switch outputFormat {
	case JSONFormat:
		return NewUTCJSONFormatter()
	default:
		return NewUTCTextFormatter()
	}
}

func getLevel(level LogLevel) logrus.Level {
	switch level {
	case TraceLevel:
		return logrus.TraceLevel
	case DebugLevel:
		return logrus.DebugLevel
	case InfoLevel:
		return logrus.InfoLevel
	case WarningLevel:
		return logrus.WarnLevel
	case ErrorLevel:
		return logrus.ErrorLevel
	default:
		return logrus.InfoLevel
	}
}

func (l *LoggerImpl) Buffer() {
	l.CoreLoggerImpl = NewBufLogger(l.CoreLogger, l.Flush)
	if l.wrappers == nil {
		l.wrappers = make(map[*logrusEntryWrapper]struct{})
	}
}

func (l *LoggerImpl) Flush() {
	if bufLogger, ok := l.CoreLoggerImpl.(*BufLogger); ok {
		// Swap logger implementations and allow wrappers set to be garbage-collected.
		l.CoreLoggerImpl = l.CoreLogger
		for wrapper := range l.wrappers {
			wrapper.CoreLoggerImpl = wrapper.coreLogger
			// Allow this to be garbage-collected.
			wrapper.wrappers = nil
		}
		// Allow this to be garbage-collected.
		l.wrappers = nil

		// Time to output retained logs to their respective loggers.
		bufLogger.Read(func(entry BufLogEntry) {
			lgr := entry.Logger

			switch entry.Level {
			case TraceLevel:
				lgr.Tracef(entry.Message, entry.Args...)
			case DebugLevel:
				lgr.Debugf(entry.Message, entry.Args...)
			case InfoLevel:
				lgr.Infof(entry.Message, entry.Args...)
			case WarningLevel:
				lgr.Warnf(entry.Message, entry.Args...)
			case ErrorLevel:
				lgr.Errorf(entry.Message, entry.Args...)
			}
		})
	}
}

func (l LoggerImpl) WithField(key string, value interface{}) Logger {
	e := l.CoreLogger.WithField(key, value)
	return wrapBufLoggerChild(l.CoreLoggerImpl, l.wrappers, e)
}

func (l LoggerImpl) WithFields(fields Fields) Logger {
	e := l.CoreLogger.WithFields(logrus.Fields(fields))
	return wrapBufLoggerChild(l.CoreLoggerImpl, l.wrappers, e)
}

func (l LoggerImpl) SetLevel(level LogLevel) {
	logrusLevel := getLevel(level)
	l.CoreLogger.SetLevel(logrusLevel)
}

func (l LoggerImpl) SetFormatter(format OutputFormat) {
	l.CoreLogger.SetFormatter(getFormatter(format))
}

func (l LoggerImpl) SetOutput(writers ...io.Writer) {
	output := io.MultiWriter(writers...)
	l.CoreLogger.SetOutput(output)
}

func (l LoggerImpl) OnConfigReload(level LogLevel) {
	logrusLevel := getLevel(level)

	if logrusLevel != l.CoreLogger.GetLevel() {
		l.SetLevel(level)
		l.Infof("Logging level changed to %s", level)
	}
}

// TODO: remove this function when the migration process to the new logging standard is complete.
func (l LoggerImpl) Logf(msg string, args ...interface{}) {
	l.Infof(msg, args...)
}

type logrusEntryWrapper struct {
	CoreLoggerImpl

	coreLogger *logrus.Entry
	wrappers   map[*logrusEntryWrapper]struct{}
}

func (l logrusEntryWrapper) SetLevel(level LogLevel) {
	l.coreLogger.Logger.SetLevel(getLevel(level))
}

func (l logrusEntryWrapper) SetOutput(writers ...io.Writer) {
	output := io.MultiWriter(writers...)
	l.coreLogger.Logger.SetOutput(output)
}

func (l logrusEntryWrapper) SetFormatter(format OutputFormat) {
	l.coreLogger.Logger.SetFormatter(getFormatter(format))
}

func (l logrusEntryWrapper) WithField(key string, value interface{}) Logger {
	e := l.coreLogger.WithField(key, value)
	return wrapBufLoggerChild(l.CoreLoggerImpl, l.wrappers, e)

}

func (l logrusEntryWrapper) WithFields(fields Fields) Logger {
	e := l.coreLogger.WithFields(logrus.Fields(fields))
	return wrapBufLoggerChild(l.CoreLoggerImpl, l.wrappers, e)
}

// TODO: remove this function when the migration process to the new logging standard is complete.
func (l logrusEntryWrapper) Logf(msg string, args ...interface{}) {
	l.Infof(msg, args...)
}

var defaultLogger Logger
var once = &sync.Once{}
var mutex sync.RWMutex

type lazyLogger interface {
	Buffer()
	Flush()
}

// Buffer makes the default logger (if supported by it) use a buffering logger
// as its underlying implementation. Buffered log entries can be flushed with Flush.
func Buffer() {
	lock := ensureDefaultLoggerReadLock()
	defer lock.RUnlock()

	if b, ok := defaultLogger.(lazyLogger); ok {
		b.Buffer()
	}
}

// Flush flushes all buffered log entries that were retained as from calling Buffer.
func Flush() {
	lock := ensureDefaultLoggerReadLock()
	defer lock.RUnlock()

	if f, ok := defaultLogger.(lazyLogger); ok {
		f.Flush()
	}
}

func ensureDefaultLoggerReadLock() *sync.RWMutex {
	// Set the default logger only once.
	once.Do(func() {
		mutex.Lock()
		defer mutex.Unlock()

		// Create default factory if not already set
		if DefaultLoggerFactory == nil {
			DefaultLoggerFactory = &LoggerFactoryImpl{}
		}

		// Set default logger
		defaultLogger = DefaultLoggerFactory.DefaultLogger()
	})

	mutex.RLock()
	return &mutex
}

// UpdateDefaultLogger should be the only way to update the default logger.
func UpdateDefaultLogger(options LoggerOptionsImpl, outputBuilder OutputBuilder) error {
	w, err := outputBuilder.Build(options.Output...)
	if err != nil {
		return err
	}

	lock := ensureDefaultLoggerReadLock()
	defer lock.RUnlock()
	defaultLogger.SetOutput(w)
	defaultLogger.SetFormatter(options.Format)
	defaultLogger.SetLevel(options.Level)

	return nil
}

// ReplaceDefaultLogger replaces the default logger. This is not ideal, but was included
// to support switching to a legacy logger.
// TODO: Remove this when all applications have fully moved to the new logging standard.
func ReplaceDefaultLogger(logger Logger) {
	// Doing this to avoid the ensureDefaultLoggerReadLock
	// to overwrite the logger setted here
	once.Do(func() {})

	mutex.Lock()
	defer mutex.Unlock()
	defaultLogger = logger
}

// UseTerminalLogger sets the DefaultLoggerFactory variable with a TerminalLoggerFactory instance.
// It makes the default logger have its output to STDERR with enhanced text formatting.
// Make sure to call it before any call to DefaultLogger or package logging function
// because the logger instance will be created for the first time that the DefaultLogger function
// is called.
func UseTerminalLogger(l LogLevel) {
	DefaultLoggerFactory = &TerminalLoggerFactory{l}
}

func DefaultLogger() Logger {
	lock := ensureDefaultLoggerReadLock()
	defer lock.RUnlock()
	return defaultLogger
}

func Debugf(msg string, args ...interface{}) {
	lock := ensureDefaultLoggerReadLock()
	defer lock.RUnlock()
	defaultLogger.Debugf(msg, args...)
}

func Tracef(msg string, args ...interface{}) {
	lock := ensureDefaultLoggerReadLock()
	defer lock.RUnlock()
	defaultLogger.Tracef(msg, args...)
}

func Infof(msg string, args ...interface{}) {
	lock := ensureDefaultLoggerReadLock()
	defer lock.RUnlock()
	defaultLogger.Infof(msg, args...)
}

func Warnf(msg string, args ...interface{}) {
	lock := ensureDefaultLoggerReadLock()
	defer lock.RUnlock()
	defaultLogger.Warnf(msg, args...)
}

func Errorf(msg string, args ...interface{}) {
	lock := ensureDefaultLoggerReadLock()
	defer lock.RUnlock()
	defaultLogger.Errorf(msg, args...)
}

func Fatal(msg string) {
	lock := ensureDefaultLoggerReadLock()
	defer lock.RUnlock()
	defaultLogger.Fatal(msg)
}

func Fatalf(msg string, args ...interface{}) {
	lock := ensureDefaultLoggerReadLock()
	defer lock.RUnlock()
	defaultLogger.Fatalf(msg, args...)
}

func Panicf(msg string, args ...interface{}) {
	lock := ensureDefaultLoggerReadLock()
	defer lock.RUnlock()
	defaultLogger.Panicf(msg, args...)
}

func WithField(key string, value interface{}) Logger {
	lock := ensureDefaultLoggerReadLock()
	defer lock.RUnlock()
	return defaultLogger.WithField(key, value)
}

func WithFields(fields Fields) Logger {
	lock := ensureDefaultLoggerReadLock()
	defer lock.RUnlock()
	return defaultLogger.WithFields(fields)
}

func wrapBufLoggerChild(lgr CoreLoggerImpl, wrappers map[*logrusEntryWrapper]struct{}, e *logrus.Entry) *logrusEntryWrapper {
	wrapper := &logrusEntryWrapper{coreLogger: e, CoreLoggerImpl: e, wrappers: wrappers}
	if bufLogger, ok := lgr.(*BufLogger); ok {
		wrappers[wrapper] = struct{}{}
		wrapper.CoreLoggerImpl = bufLogger.child(wrapper.coreLogger)
	}
	return wrapper
}
