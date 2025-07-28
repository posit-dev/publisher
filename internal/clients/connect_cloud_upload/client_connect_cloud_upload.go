package connect_cloud_upload

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/posit-dev/publisher/internal/logging"
)

// ConnectCloudUploadClient is a client for uploading bundles to Connect Cloud.
type ConnectCloudUploadClient struct {
	log       logging.Logger
	client    *http.Client
	uploadURL string
}

// NewConnectCloudUploadClient creates a new ConnectCloudUploadClient with the specified upload URL.
// This client doesn't require authentication as the upload URL is pre-signed.
func NewConnectCloudUploadClient(
	uploadURL string,
	log logging.Logger,
	timeout time.Duration) UploadAPIClient {
	client := &http.Client{
		Timeout: timeout,
	}
	return &ConnectCloudUploadClient{
		log:       log,
		client:    client,
		uploadURL: uploadURL,
	}
}

// UploadBundle uploads a bundle file to the preconfigured URL.
func (c *ConnectCloudUploadClient) UploadBundle(bundleContent io.Reader) error {
	req, err := http.NewRequest(http.MethodPost, c.uploadURL, bundleContent)
	if err != nil {
		return fmt.Errorf("error creating request: %w", err)
	}

	// Set the Content-Type header to application/octet-stream
	req.Header.Set("Content-Type", "application/octet-stream")

	// Execute the request
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("error uploading bundle: %w", err)
	}
	defer resp.Body.Close()

	// Check if the upload was successful
	if resp.StatusCode > 299 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		bodyText := string(bodyBytes)
		return fmt.Errorf("bundle upload failed with status %d: %s", resp.StatusCode, bodyText)
	}

	c.log.Info("Bundle upload successful", "status", resp.Status)
	return nil
}
