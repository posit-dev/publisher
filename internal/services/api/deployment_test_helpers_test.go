package api

// Copyright (C) 2026 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/server_type"
	"github.com/posit-dev/publisher/internal/util"
)

func createSampleDeployment(root util.AbsolutePath, name string) (*deployment.Deployment, error) {
	path := deployment.GetDeploymentPath(root, name)
	d := deployment.New()
	d.ID = "12345678"
	d.ServerType = server_type.ServerTypeConnect
	d.ConfigName = "myConfig"
	cfg := config.New()
	cfg.ProductType = config.ProductTypeConnect
	cfg.Type = contenttypes.ContentTypePythonDash
	cfg.Entrypoint = "app.py"
	cfg.Python = &config.Python{
		Version:        "3.4.5",
		PackageManager: "pip",
	}
	d.Configuration = cfg
	d.DeployedAt = "2024-09-17T16:57:51-07:00"
	d.DashboardURL = "/connect/#/apps/12345678"
	d.DirectURL = "/content/12345678/"
	d.LogsURL = "/connect/#/apps/12345678/logs"
	_, err := d.WriteFile(path, "", logging.New())
	return d, err
}
