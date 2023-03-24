package rslog

// Copyright (C) 2022 by RStudio, PBC.

import (
	"fmt"
	"sort"
	"strings"
)

// A logger with a "[app: XXX]" preamble.
// Satisfies the ReportLogger interface.
type PreambleLogger struct {
	Preamble string
	Output   DeprecatedLogger
}

func (logger PreambleLogger) Logf(msg string, args ...interface{}) {
	if logger.Output != nil {
		logger.Output.Logf(logger.Preamble+msg, args...)
	} else {
		_log_printf(logger.Preamble+msg, args...)
	}
}

// BuildPreamble constructs a logging prefix string from a set of input values.
// Most times, you will give an even number of values, which generate a prefix like:
//     [v1: v2; v3: v4]
//
// If an odd number of fields is given, the last field is presented by itself:
//     [v1: v2; v3: v4; v5]
func BuildPreamble(fields ...interface{}) string {
	n := len(fields)
	if n == 0 {
		return ""
	}

	var b strings.Builder
	b.WriteString("[")
	for i := 0; i < n; i++ {
		fmt.Fprint(&b, fields[i])
		// odd-indexed fields are followed by a semi-colon,
		// terminating the pair, unless this is the final field.
		//
		// even-indexed fields are followed by a colon, unless this is
		// the final field (this is an unbalanced pair).
		if i != n-1 {
			if i%2 == 0 {
				b.WriteString(": ")
			} else {
				b.WriteString("; ")
			}
		}
	}
	b.WriteString("] ")

	return b.String()
}

func getOrderedKey(fields Fields) []string {
	keys := make([]string, len(fields))

	i := 0
	for key := range fields {
		keys[i] = key
		i++
	}
	sort.Strings(keys)
	return keys
}

func FieldsToPreamble(fields Fields) string {
	var preambleArgs []interface{}
	keys := getOrderedKey(fields)
	for _, key := range keys {
		preambleArgs = append(preambleArgs, key, fields[key])
	}
	return BuildPreamble(preambleArgs...)
}
