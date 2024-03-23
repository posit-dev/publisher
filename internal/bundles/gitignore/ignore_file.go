package gitignore

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"path"
	"regexp"
	"strings"

	"github.com/rstudio/connect-client/internal/util"
)

type IgnoreFile struct {
	path     util.AbsolutePath
	patterns []*Pattern
}

func NewIgnoreFile(path util.AbsolutePath) (*IgnoreFile, error) {
	patterns, err := readIgnoreFile(path)
	if err != nil {
		return nil, err
	}

	return &IgnoreFile{
		path:     path,
		patterns: patterns,
	}, nil
}

func NewBuiltinIgnoreFile(builtins []string) (*IgnoreFile, error) {
	filePath := util.AbsolutePath{}
	patterns := []*Pattern{}

	for lineNum, builtin := range builtins {
		pattern, err := patternFromString(builtin, filePath, lineNum+1)
		if err != nil {
			return nil, err
		}
		patterns = append(patterns, pattern)
	}

	return &IgnoreFile{
		path:     filePath,
		patterns: patterns,
	}, nil
}

func (f *IgnoreFile) Match(filePath string) *Pattern {
	var match *Pattern

	for _, pattern := range f.patterns {
		if pattern.re.MatchString(filePath) {
			match = pattern
		}
	}
	if match == nil || match.Inverted {
		return nil
	}
	return match
}

func readIgnoreFile(ignoreFilePath util.AbsolutePath) ([]*Pattern, error) {
	content, err := ignoreFilePath.ReadFile()
	if err != nil {
		return nil, err
	}
	var patterns []*Pattern

	lines := strings.Split(string(content), "\n")
	for lineNum, line := range lines {
		pattern, err := patternFromString(line, ignoreFilePath, lineNum+1)
		if err != nil {
			return nil, err
		}

		if pattern == nil {
			continue
		}
		patterns = append(patterns, pattern)
	}
	return patterns, nil
}

func patternFromString(line string, ignoreFilePath util.AbsolutePath, lineNum int) (*Pattern, error) {
	inverted := false

	// TODO: Trailing spaces are ignored unless they are quoted with backslash ("\").
	line = strings.TrimSpace(line)
	rawRegex := line

	if line == "" {
		// A blank line matches no files, so it can serve as a separator for readability.
		return nil, nil
	}
	if line[0] == '#' {
		// A line starting with # serves as a comment. Put a backslash ("\")
		// in front of the first hash for patterns that begin with a hash.
		return nil, nil
	}
	if line[0] == '!' {
		// An optional prefix "!" which negates the pattern; any matching
		// file excluded by a previous pattern will become included again.
		inverted = true
		rawRegex = line[1:]
	}
	if strings.HasPrefix(line, `\!`) || strings.HasPrefix(line, `\#`) {
		// Put a backslash ("\") in front of the first hash for patterns that begin with a hash.
		// Put a backslash ("\") in front of the first "!" for patterns that begin with a literal "!"
		rawRegex = line[1:]
	}

	// If there is a separator at the beginning or middle (or both) of the
	// pattern, then the pattern is relative to the directory level of the
	// particular .gitignore file itself.
	// We'll need this later.
	isRooted := strings.ContainsRune(rawRegex[:len(rawRegex)-1], '/')

	prefix := ""
	if strings.HasPrefix(rawRegex, "**/") {
		// A leading "**" followed by a slash means match in all
		// directories. For example, "**/foo" matches file or directory
		// "foo" anywhere, the same as pattern "foo". "**/foo/bar" matches
		// file or directory "bar" anywhere that is directly under directory
		// "foo".
		prefix = `((.*/)|)`
		rawRegex = rawRegex[3:]
	}

	suffix := ""
	if strings.HasSuffix(rawRegex, "/**") || strings.HasSuffix(rawRegex, "/") {
		// A trailing "/**" matches everything inside. For example, "abc/**"
		// matches all files inside directory "abc", relative to the location
		// of the .gitignore file, with infinite depth.
		suffix = `/.*`
		lastSlashIndex := strings.LastIndex(rawRegex, "/")
		rawRegex = rawRegex[:lastSlashIndex]
	} else {
		// If there is a separator at the end of the pattern then the pattern
		// will only match directories, otherwise the pattern can match both
		// files and directories.
		suffix = "(/.*)?"
	}

	// A slash followed by two consecutive asterisks then a slash matches
	// zero or more directories. For example, "a/**/b" matches "a/b",
	// "a/x/b", "a/x/y/b" and so on.
	// Since we're about to substitute all asterisks, insert
	// a temporary placeholder that has no asterisks.
	const placeholder = "$ANY_DIR_PLACEHOLDER$"
	rawRegex = strings.ReplaceAll(rawRegex, "/**/", placeholder)

	// Other consecutive asterisks are considered regular asterisks and will
	// match according to the previous rules.
	// An asterisk "*" matches anything except a slash.
	rawRegex = strings.ReplaceAll(rawRegex, "*", "([^/]*)")

	// Part 2 of "/**/" handling: insert the actual regex that matches /**/.
	rawRegex = strings.ReplaceAll(rawRegex, placeholder, `/((.*/)|)`)

	// The character "?" matches any one character except "/".
	rawRegex = strings.ReplaceAll(rawRegex, "?", "[^/]")

	// The range notation, e.g. [a-zA-Z], can be used to match one of the
	// characters in a range. Note this is already valid regex syntax.

	// Put the prefix and suffix back on (now that * substitution is done)
	rawRegex = prefix + rawRegex + suffix

	if isRooted {
		// If there is a separator at the beginning or middle (or both) of the
		// pattern, then the pattern is relative to the directory level of the
		// particular .gitignore file itself.
		rawRegex = path.Join(ignoreFilePath.Dir().ToSlash(), rawRegex)
	} else {
		// Otherwise the pattern may also match at any level below the
		// .gitignore level.
		rawRegex = ignoreFilePath.Dir().ToSlash() + `((/.*/)|/)` + rawRegex
	}

	rawRegex = "^" + rawRegex + "$"

	fmt.Printf("pattern %s is regex %s\n", line, rawRegex)

	regex, err := regexp.Compile(rawRegex)
	if err != nil {
		return nil, err
	}

	source := MatchSourceFile
	if ignoreFilePath.String() == "" {
		source = MatchSourceBuiltIn
	}

	return &Pattern{
		Source:   source,
		FilePath: ignoreFilePath,
		Line:     lineNum,
		Pattern:  line,
		Inverted: inverted,
		re:       regex,
	}, nil
}
