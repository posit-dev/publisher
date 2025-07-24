package connect_cloud_upload

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
)

type ConnectCloudUploadClientSuite struct {
	utiltest.Suite
}

func TestConnectCloudUploadClientSuite(t *testing.T) {
	s := new(ConnectCloudUploadClientSuite)
	suite.Run(t, s)
}

func (s *ConnectCloudUploadClientSuite) TestNewConnectCloudUploadClient() {
	timeout := 10 * time.Second
	log := logging.New()

	apiClient := NewConnectCloudUploadClient("https://upload.url.example.com", log, timeout)
	client := apiClient.(*ConnectCloudUploadClient)
	s.NotNil(client.client)
	s.Equal("https://upload.url.example.com", client.uploadURL)
}

func (s *ConnectCloudUploadClientSuite) TestUploadBundle() {
	// Create a test server that will handle our upload
	var receivedData bytes.Buffer
	var receivedContentType string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedContentType = r.Header.Get("Content-Type")
		io.Copy(&receivedData, r.Body)
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	// Create the client
	timeout := 10 * time.Second
	log := logging.New()
	apiClient := NewConnectCloudUploadClient(server.URL, log, timeout)

	// Create test data to upload
	testData := []byte("This is test bundle data for upload")
	bundleContent := bytes.NewReader(testData)

	// Upload the bundle
	err := apiClient.UploadBundle(bundleContent)
	s.NoError(err)

	// Verify the content type and uploaded data
	assert.Equal(s.T(), "application/octet-stream", receivedContentType)
	assert.Equal(s.T(), testData, receivedData.Bytes())
}

func (s *ConnectCloudUploadClientSuite) TestUploadBundle_Error() {
	// Create a test server that will respond with an error
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("Upload failed"))
	}))
	defer server.Close()

	// Create the client
	timeout := 10 * time.Second
	log := logging.New()
	apiClient := NewConnectCloudUploadClient(server.URL, log, timeout)

	// Create test data to upload
	testData := []byte("This is test bundle data for upload")
	bundleContent := bytes.NewReader(testData)

	// Upload the bundle - should fail
	err := apiClient.UploadBundle(bundleContent)
	s.Error(err)
	s.Contains(err.Error(), "bundle upload failed with status 500")
}