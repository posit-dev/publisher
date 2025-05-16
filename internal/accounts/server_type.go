package accounts

import (
	"net/url"
	"strings"
)

// Copyright (C) 2023 by Posit Software, PBC.

type ServerType string

const (
	ServerTypeConnect     ServerType = "connect"
	ServerTypeShinyappsIO ServerType = "shinyapps"
	ServerTypeCloud       ServerType = "cloud"
	ServerTypeSnowflake   ServerType = "snowflake"
)

var accountTypeDescriptions = map[ServerType]string{
	ServerTypeConnect:     "Posit Connect",
	ServerTypeShinyappsIO: "shinyapps.io",
	ServerTypeCloud:       "Posit Cloud",
	ServerTypeSnowflake:   "Snowflake",
}

func (t ServerType) Description() string {
	if desc, ok := accountTypeDescriptions[t]; ok {
		return desc
	}
	return string(t)
}

// ServerTypeFromURL infers a server type from the server URL.
// For Posit-deployed servers (shinyapps.io, posit.cloud) or Snowflake,
// it returns the corresponding type. Otherwise,
// it assumes a Connect server.
//
// Returns an error if the given URL is invalid.
func ServerTypeFromURL(urlStr string) (ServerType, error) {
	u, err := url.Parse(urlStr)
	if err != nil {
		return "", err
	}
	host := u.Hostname()
	if strings.HasSuffix(host, ".posit.cloud") {
		return ServerTypeCloud, nil
	} else if strings.HasSuffix(host, ".rstudio.cloud") {
		return ServerTypeCloud, nil
	} else if strings.HasSuffix(host, ".shinyapps.io") {
		return ServerTypeShinyappsIO, nil
	} else if strings.HasSuffix(host, ".snowflakecomputing.app") {
		return ServerTypeSnowflake, nil
	}
	return ServerTypeConnect, nil
}
