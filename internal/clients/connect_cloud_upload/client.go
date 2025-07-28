package connect_cloud_upload

// Copyright (C) 2025 by Posit Software, PBC.

import "io"

// UploadAPIClient defines the interface for uploading bundles to Connect Cloud.
type UploadAPIClient interface {
	// UploadBundle uploads a bundle file to the preconfigured URL.
	// It takes a reader for the bundle content and returns error if the upload fails.
	UploadBundle(bundleContent io.Reader) error
}