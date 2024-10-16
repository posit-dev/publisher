package types

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type ApiErrorsSuite struct {
	utiltest.Suite
}

func TestApiErrorsSuite(t *testing.T) {
	suite.Run(t, new(ApiErrorsSuite))
}

func (s *ApiErrorsSuite) TestAPIErrorUnknownTOMLKeyFromAgentError() {
	agentErr := AgentError{
		Message: "Unknown field present in configuration file",
		Code:    ErrorUnknownTOMLKey,
		Err:     errors.New("unknown field error"),
		Data: ErrorData{
			"file":   "/project-a/configuration-avcd.toml",
			"line":   3,
			"column": 1,
			"key":    "shortcut",
		},
	}

	rec := httptest.NewRecorder()

	apiError := APIErrorUnknownTOMLKeyFromAgentError(agentErr)
	s.Equal(apiError.Code, ErrorUnknownTOMLKey)

	apiError.JSONResponse(rec)

	bodyRes := rec.Body.String()
	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
	s.Contains(bodyRes, `{"code":"unknownTOMLKey","details":{"filename":"/project-a/configuration-avcd.toml","line":3,"column":1,"key":"shortcut"}}`)
}

func (s *ApiErrorsSuite) TestAPIErrorInvalidTOMLFileFromAgentError() {
	agentErr := AgentError{
		Message: "Bad syntax",
		Code:    ErrorInvalidTOML,
		Err:     errors.New("unknown field error"),
		Data: ErrorData{
			"file":   "/project-a/configuration-avcd.toml",
			"line":   3,
			"column": 1,
		},
	}

	rec := httptest.NewRecorder()

	apiError := APIErrorInvalidTOMLFileFromAgentError(agentErr)
	s.Equal(apiError.Code, ErrorInvalidTOML)

	apiError.JSONResponse(rec)

	bodyRes := rec.Body.String()
	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
	s.Contains(bodyRes, `{"code":"invalidTOML","details":{"filename":"/project-a/configuration-avcd.toml","line":3,"column":1}}`)
}
