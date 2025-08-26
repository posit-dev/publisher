package config

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"testing"

	"github.com/stretchr/testify/suite"
)

type ConfigProductTypeComplianceSuite struct {
	suite.Suite
}

func TestConfig_ForceProductTypeCompliance(t *testing.T) {
	suite.Run(t, new(ConfigProductTypeComplianceSuite))
}

// TestConnectCloudWithAllSettings tests when ProductType is ProductTypeConnectCloud
// and all settings (Python, R, Quarto, Jupyter) are present.
func (s *ConfigProductTypeComplianceSuite) TestConnectCloudWithAllSettings() {
	cfg := &Config{
		ProductType: ProductTypeConnectCloud,
		Python: &Python{
			Version:               "3.9.7",
			PackageManager:        "pip",
			PackageFile:           "requirements.txt",
			RequiresPythonVersion: ">=3.9.0",
		},
		R: &R{
			Version:          "4.2.1",
			PackageManager:   "packrat",
			PackageFile:      "packrat.lock",
			RequiresRVersion: ">=4.0.0",
		},
		Quarto: &Quarto{
			Version: "1.3.0",
			Engines: []string{"knitr", "jupyter"},
		},
		Jupyter: &Jupyter{
			HideAllInput:    true,
			HideTaggedInput: true,
		},
	}

	cfg.ForceProductTypeCompliance()

	// Verify Python fields
	s.Equal("3.9", cfg.Python.Version)
	s.Equal("", cfg.Python.PackageManager)
	s.Equal("", cfg.Python.PackageFile)
	s.Equal("", cfg.Python.RequiresPythonVersion)

	// Verify R fields
	s.Equal("4.2.1", cfg.R.Version)
	s.Equal("", cfg.R.PackageManager)
	s.Equal("", cfg.R.PackageFile)
	s.Equal("", cfg.R.RequiresRVersion)

	// Verify Quarto and Jupyter are set to nil
	s.Nil(cfg.Quarto)
	s.Nil(cfg.Jupyter)
}

// TestConnectCloudWithMalformedPythonVersion tests when ProductType is ProductTypeConnectCloud
// and Python version is malformed.
func (s *ConfigProductTypeComplianceSuite) TestConnectCloudWithMalformedPythonVersion() {
	// Test with an empty version string
	emptyVersion := &Config{
		ProductType: ProductTypeConnectCloud,
		Python: &Python{
			Version: "",
		},
	}

	emptyVersion.ForceProductTypeCompliance()
	// Empty version should remain empty
	s.Equal("", emptyVersion.Python.Version)

	// Test with a malformed version string
	malformedVersion := &Config{
		ProductType: ProductTypeConnectCloud,
		Python: &Python{
			Version: "3",
		},
	}

	malformedVersion.ForceProductTypeCompliance()
	// Malformed version should remain as is since it doesn't have enough parts
	s.Equal("3", malformedVersion.Python.Version)
}

// TestProductTypeConnect tests when ProductType is ProductTypeConnect.
// No changes should be made to the configuration.
func (s *ConfigProductTypeComplianceSuite) TestProductTypeConnect() {
	cfg := &Config{
		Alternatives: []Config{
			{
				Python: &Python{
					Version:               "3.9.7",
					PackageManager:        "pip",
					PackageFile:           "requirements.txt",
					RequiresPythonVersion: ">=3.9.0",
				},
			},
		},
		Entrypoint:          "some-entrypoint.py",
		EntrypointObjectRef: "some-ref",
		ProductType:         ProductTypeConnect,
		Python: &Python{
			Version:               "3.9.7",
			PackageManager:        "pip",
			PackageFile:           "requirements.txt",
			RequiresPythonVersion: ">=3.9.0",
		},
		R: &R{
			Version:          "4.2.1",
			PackageManager:   "packrat",
			PackageFile:      "packrat.lock",
			RequiresRVersion: ">=4.0.0",
		},
		Quarto: &Quarto{
			Version: "1.3.0",
			Engines: []string{"knitr", "jupyter"},
		},
		Jupyter: &Jupyter{
			HideAllInput:    true,
			HideTaggedInput: true,
		},
	}

	// Create a deep copy to compare after the method call
	original := *cfg
	originalPython := *cfg.Python
	originalR := *cfg.R
	originalQuarto := *cfg.Quarto
	originalJupyter := *cfg.Jupyter

	cfg.ForceProductTypeCompliance()

	// Verify fields that interfere with schema validation are cleared up
	s.Equal("", cfg.EntrypointObjectRef)
	s.Nil(cfg.Alternatives)

	// Verify all fields remain unchanged for ProductTypeConnect
	s.Equal(original.ProductType, cfg.ProductType)

	s.Equal(originalPython.Version, cfg.Python.Version)
	s.Equal(originalPython.PackageManager, cfg.Python.PackageManager)
	s.Equal(originalPython.PackageFile, cfg.Python.PackageFile)
	s.Equal(originalPython.RequiresPythonVersion, cfg.Python.RequiresPythonVersion)

	s.Equal(originalR.Version, cfg.R.Version)
	s.Equal(originalR.PackageManager, cfg.R.PackageManager)
	s.Equal(originalR.PackageFile, cfg.R.PackageFile)
	s.Equal(originalR.RequiresRVersion, cfg.R.RequiresRVersion)

	s.Equal(originalQuarto.Version, cfg.Quarto.Version)
	s.Equal(originalQuarto.Engines, cfg.Quarto.Engines)

	s.Equal(originalJupyter.HideAllInput, cfg.Jupyter.HideAllInput)
	s.Equal(originalJupyter.HideTaggedInput, cfg.Jupyter.HideTaggedInput)
}
