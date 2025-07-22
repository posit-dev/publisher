package schema

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/server_type"
	"github.com/stretchr/testify/suite"
)

type ConversionSuite struct {
	suite.Suite
}

func TestConversion(t *testing.T) {
	suite.Run(t, new(ConversionSuite))
}

func (s *ConversionSuite) TestUpgradePublishingSchema() {
	// Test v3 to v4 schema upgrade
	v3Schema := map[string]interface{}{
		"$schema": "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json",
		"type":    "quarto-static",
	}

	UpgradePublishingSchema(v3Schema)

	s.Equal(ConfigSchemaURL, v3Schema["$schema"])
	s.Equal(server_type.ServerTypeConnect, v3Schema["server_type"])
}

func (s *ConversionSuite) TestUpgradePublishingRecordSchema() {
	// Test record schema upgrade with connect URL
	v3RecordSchema := map[string]interface{}{
		"$schema":    "https://cdn.posit.co/publisher/schemas/posit-publishing-record-schema-v3.json",
		"server_url": "https://connect.example.com",
		"configuration": map[string]interface{}{
			"$schema": "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json",
		},
	}

	err := UpgradePublishingRecordSchema(v3RecordSchema)
	s.NoError(err)
	s.Equal(DeploymentSchemaURL, v3RecordSchema["$schema"])
	s.Equal(server_type.ServerTypeConnect, v3RecordSchema["server_type"])
	s.Nil(v3RecordSchema["account_name"])

	// Check that nested configuration was upgraded
	config, ok := v3RecordSchema["configuration"].(map[string]interface{})
	s.True(ok)
	s.Equal(ConfigSchemaURL, config["$schema"])

	// Test with connect cloud URL
	cloudSchema := map[string]interface{}{
		"$schema":    "https://cdn.posit.co/publisher/schemas/posit-publishing-record-schema-v3.json",
		"server_url": "https://myaccount.connect.posit.cloud",
	}

	err = UpgradePublishingRecordSchema(cloudSchema)
	s.NoError(err)
	s.Equal(server_type.ServerTypeConnectCloud, cloudSchema["server_type"])

	// Test with snowflake URL
	snowflakeSchema := map[string]interface{}{
		"$schema":    "https://cdn.posit.co/publisher/schemas/posit-publishing-record-schema-v3.json",
		"server_url": "https://app.snowflakecomputing.app",
	}

	err = UpgradePublishingRecordSchema(snowflakeSchema)
	s.NoError(err)
	s.Equal(server_type.ServerTypeSnowflake, snowflakeSchema["server_type"])

	// Test with invalid URL
	invalidSchema := map[string]interface{}{
		"$schema":    "https://cdn.posit.co/publisher/schemas/posit-publishing-record-schema-v3.json",
		"server_url": "://invalid-url",
	}

	err = UpgradePublishingRecordSchema(invalidSchema)
	s.Error(err)
}
