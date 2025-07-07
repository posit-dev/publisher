package schema

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/server_type"
)

// UpgradePublishingSchema upgrades a publishing schema instance to the current version.
func UpgradePublishingSchema(data map[string]interface{}) {
	currentSchema, _ := data["$schema"].(string)
	if currentSchema != ConfigSchemaURL {
		// Update the $schema to the latest version
		data["$schema"] = ConfigSchemaURL

		// Assume server_type is connect. It might actually be snowflake, but we don't have enough information to
		// determine that, and it shouldn't matter regardless.
		data["server_type"] = server_type.ServerTypeConnect
	}
}

// UpgradePublishingRecordSchema modifies a publishing record schema instance to the current version.
func UpgradePublishingRecordSchema(data map[string]interface{}) error {
	currentSchema, _ := data["$schema"].(string)
	if currentSchema != DeploymentSchemaURL {
		// Update the $schema to v4
		data["$schema"] = DeploymentSchemaURL

		serverUrl, ok := data["server_url"].(string)
		if ok {
			serverType, err := server_type.ServerTypeFromURL(serverUrl)
			if err != nil {
				return err
			}
			data["server_type"] = serverType
		}

		data["account_name"] = nil

		// configuration is a v3 publishing schema instance, so we need to upgrade it
		configuration, _ := data["configuration"].(map[string]interface{})
		UpgradePublishingSchema(configuration)
	}
	return nil
}
