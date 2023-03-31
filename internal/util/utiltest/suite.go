package utiltest

// This is a version of stretchr/testify/suite that uses Require
// by default, so that a single failed assertion will fail a test.
// This makes it easier to see what failed.
// Inspired by https://github.com/stretchr/testify/pull/1344
// Changes are
// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"os"
	"reflect"
	"regexp"
	"runtime/debug"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

var allTestsFilter = func(_, _ string) (bool, error) { return true, nil }

// Suite is a basic testing suite with methods for storing and
// retrieving the current *testing.T context.
type Suite struct {
	*require.Assertions

	mu     sync.RWMutex
	assert *assert.Assertions
	t      *testing.T

	// Parent suite to have access to the implemented methods of parent struct
	s suite.TestingSuite
}

// T retrieves the current *testing.T context.
func (s *Suite) T() *testing.T {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.t
}

// SetT sets the current *testing.T context.
func (s *Suite) SetT(t *testing.T) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.t = t
	s.Assertions = require.New(t)
	s.assert = assert.New(t)
}

// SetS needs to set the current test suite as parent
// to get access to the parent methods
func (s *Suite) SetS(newS suite.TestingSuite) {
	s.s = newS
}

// Require returns a require context for suite.
func (s *Suite) Require() *require.Assertions {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.Assertions == nil {
		s.Assertions = require.New(s.T())
	}
	return s.Assertions
}

// Assert returns an assert context for suite.  Normally, you can call
// `suite.NoError(expected, actual)`, but for situations where the embedded
// methods are overridden (for example, you might want to override
// assert.Assertions with require.Assertions), this method is provided so you
// can call `suite.Assert().NoError()`.
func (s *Suite) Assert() *assert.Assertions {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.assert == nil {
		s.assert = assert.New(s.T())
	}
	return s.assert
}

func recoverAndFailOnPanic(t *testing.T) {
	r := recover()
	failOnPanic(t, r)
}

func failOnPanic(t *testing.T, r interface{}) {
	if r != nil {
		t.Errorf("test panicked: %v\n%s", r, debug.Stack())
		t.FailNow()
	}
}

// Run provides suite functionality around golang subtests.  It should be
// called in place of t.Run(name, func(t *testing.T)) in test suite code.
// The passed-in func will be executed as a subtest with a fresh instance of t.
// Provides compatibility with go test pkg -run TestSuite/TestName/SubTestName.
func (s *Suite) Run(name string, subtest func()) bool {
	oldT := s.T()

	if setupSubTest, ok := s.s.(suite.SetupSubTest); ok {
		setupSubTest.SetupSubTest()
	}

	defer func() {
		s.SetT(oldT)
		if tearDownSubTest, ok := s.s.(suite.TearDownSubTest); ok {
			tearDownSubTest.TearDownSubTest()
		}
	}()

	return oldT.Run(name, func(t *testing.T) {
		s.SetT(t)
		subtest()
	})
}

// Run takes a testing suite and runs all of the tests attached
// to it.
func Run(t *testing.T, s suite.TestingSuite) {
	defer recoverAndFailOnPanic(t)

	s.SetT(t)
	s.SetS(s)

	var suiteSetupDone bool

	var stats *SuiteInformation
	if _, ok := s.(suite.WithStats); ok {
		stats = newSuiteInformation()
	}

	tests := []testing.InternalTest{}
	methodFinder := reflect.TypeOf(s)
	suiteName := methodFinder.Elem().Name()

	for i := 0; i < methodFinder.NumMethod(); i++ {
		method := methodFinder.Method(i)

		ok, err := methodFilter(method.Name)
		if err != nil {
			fmt.Fprintf(os.Stderr, "testify: invalid regexp for -m: %s\n", err)
			os.Exit(1)
		}

		if !ok {
			continue
		}

		if !suiteSetupDone {
			if stats != nil {
				stats.Start = time.Now()
			}

			if setupAllSuite, ok := s.(suite.SetupAllSuite); ok {
				setupAllSuite.SetupSuite()
			}

			suiteSetupDone = true
		}

		test := testing.InternalTest{
			Name: method.Name,
			F: func(t *testing.T) {
				parentT := s.T()
				s.SetT(t)
				defer recoverAndFailOnPanic(t)
				defer func() {
					r := recover()

					if stats != nil {
						passed := !t.Failed() && r == nil
						stats.end(method.Name, passed)
					}

					if afterTestSuite, ok := s.(suite.AfterTest); ok {
						afterTestSuite.AfterTest(suiteName, method.Name)
					}

					if tearDownTestSuite, ok := s.(suite.TearDownTestSuite); ok {
						tearDownTestSuite.TearDownTest()
					}

					s.SetT(parentT)
					failOnPanic(t, r)
				}()

				if setupTestSuite, ok := s.(suite.SetupTestSuite); ok {
					setupTestSuite.SetupTest()
				}
				if beforeTestSuite, ok := s.(suite.BeforeTest); ok {
					beforeTestSuite.BeforeTest(methodFinder.Elem().Name(), method.Name)
				}

				if stats != nil {
					stats.start(method.Name)
				}

				method.Func.Call([]reflect.Value{reflect.ValueOf(s)})
			},
		}
		tests = append(tests, test)
	}
	if suiteSetupDone {
		defer func() {
			if tearDownAllSuite, ok := s.(suite.TearDownAllSuite); ok {
				tearDownAllSuite.TearDownSuite()
			}

			if suiteWithStats, measureStats := s.(suite.WithStats); measureStats {
				stats.End = time.Now()
				suiteWithStats.HandleStats(suiteName, &stats.SuiteInformation)
			}
		}()
	}

	runTests(t, tests)
}

// Filtering method according to set regular expression
// specified command-line argument -m
func methodFilter(name string) (bool, error) {
	if ok, _ := regexp.MatchString("^Test", name); !ok {
		return false, nil
	}
	return true, nil
}

func runTests(t testing.TB, tests []testing.InternalTest) {
	if len(tests) == 0 {
		t.Log("warning: no tests to run")
		return
	}

	r, ok := t.(runner)
	if !ok { // backwards compatibility with Go 1.6 and below
		if !testing.RunTests(allTestsFilter, tests) {
			t.Fail()
		}
		return
	}

	for _, test := range tests {
		r.Run(test.Name, test.F)
	}
}

type runner interface {
	Run(name string, f func(t *testing.T)) bool
}

// SuiteInformation stats stores stats for the whole suite execution.
type SuiteInformation struct {
	suite.SuiteInformation
}

func newSuiteInformation() *SuiteInformation {
	testStats := make(map[string]*suite.TestInformation)

	return &SuiteInformation{
		SuiteInformation: suite.SuiteInformation{
			TestStats: testStats,
		},
	}
}

func (s SuiteInformation) start(testName string) {
	s.TestStats[testName] = &suite.TestInformation{
		TestName: testName,
		Start:    time.Now(),
	}
}

func (s SuiteInformation) end(testName string, passed bool) {
	s.TestStats[testName].End = time.Now()
	s.TestStats[testName].Passed = passed
}
