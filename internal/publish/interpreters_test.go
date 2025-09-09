package publish

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/server_type"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type DeployDependenciesSuite struct {
	utiltest.Suite
	log        logging.Logger
	emitter    events.Emitter
	fs         afero.Fs
	stateStore *state.State
	dir        util.AbsolutePath
}

func TestDeployDependenciesSuite(t *testing.T) {
	suite.Run(t, new(DeployDependenciesSuite))
}

func (s *DeployDependenciesSuite) SetupTest() {
	// Create a filesystem for testing
	s.fs = afero.NewMemMapFs()
	s.dir = util.NewAbsolutePath("/test/dir", s.fs)
	s.dir.MkdirAll(0755)

	// Set up logging and events
	s.log = logging.NewDiscardLogger()
	s.emitter = events.NewCapturingEmitter()

	// Create state with required properties
	s.stateStore = &state.State{
		Dir:         s.dir,
		AccountName: "test-account",
		ConfigName:  "test-config",
		TargetName:  "test-target",
		SaveName:    "test-save",
		Account: &accounts.Account{
			Name:       "test-account",
			URL:        "https://test-server.com",
			ServerType: server_type.ServerTypeConnect,
		},
		Target:  deployment.New(),
		LocalID: "test-local-id",
	}
}

func (s *DeployDependenciesSuite) TearDownTest() {
	// Clean up test directory if needed
}

func (s *DeployDependenciesSuite) createPublisher() *defaultPublisher {
	helper := publishhelper.NewPublishHelper(s.stateStore, s.log)
	return &defaultPublisher{
		log:           s.log,
		emitter:       s.emitter,
		r:             util.NewPath("R", s.fs),
		python:        util.NewPath("python", s.fs),
		PublishHelper: helper,
	}
}

func (s *DeployDependenciesSuite) TestConfigureDependenciesPython() {
	// Create a requirements.txt file
	requirementsTxt := `
# Comment line
numpy==1.22.0
pandas>=1.3.0
scikit-learn
# Another comment
flask==2.0.1
`
	requirementsPath := s.dir.Join(interpreters.PythonRequirementsFilename)
	err := requirementsPath.WriteFile([]byte(requirementsTxt), 0644)
	s.NoError(err)

	// Configure the publisher with Python settings
	s.stateStore.Config = &config.Config{
		Python: &config.Python{
			Version: "3.9",
		},
	}

	// Create and run the publisher
	publisher := s.createPublisher()
	err = publisher.addDependenciesToTarget(nil)
	s.NoError(err)

	// Check that the requirements were extracted correctly
	s.NotNil(publisher.Target.Requirements)

	expectedRequirements := []string{
		"numpy==1.22.0",
		"pandas>=1.3.0",
		"scikit-learn",
		"flask==2.0.1",
	}

	s.Equal(expectedRequirements, publisher.Target.Requirements)
	s.Nil(publisher.Target.Renv) // No R environment should be configured
}

func (s *DeployDependenciesSuite) TestConfigureDependenciesR() {
	// Create an renv.lock file
	renvLockContent := `{
  "R": {
    "Version": "4.2.0",
    "Repositories": [
      {
        "Name": "CRAN",
        "URL": "https://cran.rstudio.com"
      }
    ]
  },
  "Packages": {
    "ggplot2": {
      "Package": "ggplot2",
      "Version": "3.4.0",
      "Source": "Repository",
      "Repository": "CRAN",
      "Hash": "0a3c5486c0becf09adf603a63a234635",
      "Requirements": []
    },
    "dplyr": {
      "Package": "dplyr",
      "Version": "1.1.0",
      "Source": "Repository",
      "Repository": "CRAN",
      "Hash": "d3c34618017e7ae252d46d79a1b9892c",
      "Requirements": []
    }
  }
}`

	renvPath := s.dir.Join(interpreters.DefaultRenvLockfile)
	err := renvPath.WriteFile([]byte(renvLockContent), 0644)
	s.NoError(err)

	// Configure the publisher with R settings
	s.stateStore.Config = &config.Config{
		R: &config.R{
			Version: "4.2.0",
		},
	}

	// Create and run the publisher
	publisher := s.createPublisher()
	err = publisher.addDependenciesToTarget(nil)
	s.NoError(err)

	// Check that the R environment was extracted correctly
	s.NotNil(publisher.Target.Renv)
	s.Equal("4.2.0", publisher.Target.Renv.R.Version)

	// Check package details
	s.Equal(2, len(publisher.Target.Renv.Packages))

	// Check for ggplot2
	s.Contains(publisher.Target.Renv.Packages, renv.PackageName("ggplot2"))
	ggplot := publisher.Target.Renv.Packages[renv.PackageName("ggplot2")]
	s.Equal("3.4.0", ggplot.Version)
	s.Equal("Repository", ggplot.Source)
	s.Equal(renv.RepoURL("CRAN"), ggplot.Repository)

	// Check for dplyr
	s.Contains(publisher.Target.Renv.Packages, renv.PackageName("dplyr"))
	dplyr := publisher.Target.Renv.Packages[renv.PackageName("dplyr")]
	s.Equal("1.1.0", dplyr.Version)
	s.Equal("Repository", dplyr.Source)
	s.Equal(renv.RepoURL("CRAN"), dplyr.Repository)

	s.Empty(publisher.Target.Requirements) // No Python requirements should be set
}

func (s *DeployDependenciesSuite) TestConfigureDependenciesBoth() {
	// Create a requirements.txt file
	requirementsTxt := `
flask==2.0.1
numpy==1.22.0
`
	requirementsPath := s.dir.Join(interpreters.PythonRequirementsFilename)
	err := requirementsPath.WriteFile([]byte(requirementsTxt), 0644)
	s.NoError(err)

	// Create an renv.lock file
	renvLockContent := `{
  "R": {
    "Version": "4.2.0",
    "Repositories": [
      {
        "Name": "CRAN",
        "URL": "https://cran.rstudio.com"
      }
    ]
  },
  "Packages": {
    "shiny": {
      "Package": "shiny",
      "Version": "1.7.4",
      "Source": "Repository",
      "Repository": "CRAN",
      "Hash": "c2eae3d8c670fa9dfa35a12066f4a1d5",
      "Requirements": []
    }
  }
}`

	renvPath := s.dir.Join(interpreters.DefaultRenvLockfile)
	err = renvPath.WriteFile([]byte(renvLockContent), 0644)
	s.NoError(err)

	// Configure the publisher with both R and Python settings
	s.stateStore.Config = &config.Config{
		R: &config.R{
			Version: "4.2.0",
		},
		Python: &config.Python{
			Version: "3.9",
		},
	}

	// Create and run the publisher
	publisher := s.createPublisher()
	err = publisher.addDependenciesToTarget(nil)
	s.NoError(err)

	// Check that the Python requirements were extracted correctly
	s.NotNil(publisher.Target.Requirements)
	expectedRequirements := []string{
		"flask==2.0.1",
		"numpy==1.22.0",
	}
	s.Equal(expectedRequirements, publisher.Target.Requirements)

	// Check that the R environment was extracted correctly
	s.NotNil(publisher.Target.Renv)
	s.Equal("4.2.0", publisher.Target.Renv.R.Version)

	// Check package details
	s.Equal(1, len(publisher.Target.Renv.Packages))
	s.Contains(publisher.Target.Renv.Packages, renv.PackageName("shiny"))
	shiny := publisher.Target.Renv.Packages[renv.PackageName("shiny")]
	s.Equal("1.7.4", shiny.Version)
	s.Equal("Repository", shiny.Source)
	s.Equal(renv.RepoURL("CRAN"), shiny.Repository)
}

func (s *DeployDependenciesSuite) TestConfigureDependenciesCustomFilenames() {
	// Create a custom requirements file
	requirementsTxt := "tensorflow==2.9.0"
	customRequirementsPath := s.dir.Join("custom-requirements.txt")
	err := customRequirementsPath.WriteFile([]byte(requirementsTxt), 0644)
	s.NoError(err)

	// Create a custom renv lock file
	renvLockContent := map[string]interface{}{
		"R": map[string]interface{}{
			"Version": "4.1.0",
			"Repositories": []map[string]string{
				{
					"Name": "CRAN",
					"URL":  "https://cran.rstudio.com",
				},
			},
		},
		"Packages": map[string]interface{}{
			"tidyverse": map[string]interface{}{
				"Package":    "tidyverse",
				"Version":    "1.3.2",
				"Source":     "Repository",
				"Repository": "CRAN",
				"Hash":       "a7b2a7fe2c4ab12134839835f87ce2c8",
			},
		},
	}
	renvLockContentBytes, err := json.Marshal(renvLockContent)
	s.NoError(err)

	customRenvPath := s.dir.Join("custom-renv.lock")
	err = customRenvPath.WriteFile(renvLockContentBytes, 0644)
	s.NoError(err)

	// Configure the publisher with custom filenames
	s.stateStore.Config = &config.Config{
		R: &config.R{
			Version:     "4.1.0",
			PackageFile: "custom-renv.lock",
		},
		Python: &config.Python{
			Version:     "3.8",
			PackageFile: "custom-requirements.txt",
		},
	}

	// Create and run the publisher
	publisher := s.createPublisher()
	err = publisher.addDependenciesToTarget(nil)
	s.NoError(err)

	// Check Python requirements
	s.NotNil(publisher.Target.Requirements)
	s.Equal([]string{"tensorflow==2.9.0"}, publisher.Target.Requirements)

	// Check R environment
	s.NotNil(publisher.Target.Renv)
	s.Equal("4.1.0", publisher.Target.Renv.R.Version)
	s.Contains(publisher.Target.Renv.Packages, renv.PackageName("tidyverse"))
}

func (s *DeployDependenciesSuite) TestConfigureDependenciesMissingFiles() {
	// Configure the publisher with both R and Python settings,
	// but don't create the corresponding files
	s.stateStore.Config = &config.Config{
		R: &config.R{
			Version: "4.2.0",
		},
		Python: &config.Python{
			Version: "3.9",
		},
	}

	// Create and run the publisher
	publisher := s.createPublisher()
	err := publisher.addDependenciesToTarget(nil)
	s.Error(err) // We expect an error since the files don't exist

	// The Target properties should remain nil
	s.Nil(publisher.Target.Requirements)
	s.Nil(publisher.Target.Renv)
}
