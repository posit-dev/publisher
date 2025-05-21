package auth

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"net/http"
	"testing"

	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type NullAuthSuite struct {
	utiltest.Suite
}

func TestNullAuthSuite(t *testing.T) {
	suite.Run(t, new(NullAuthSuite))
}

func (s *NullAuthSuite) TestAddAuthHeaders() {
	auth := NewNullAuthenticator()

	req, err := http.NewRequest("GET", "", nil)
	s.NoError(err)

	req.Header.Add("X-Existing", "unchanged")

	err = auth.AddAuthHeaders(req)
	s.NoError(err)

	s.Equal(http.Header{
		"X-Existing": []string{"unchanged"},
	}, req.Header)
}
