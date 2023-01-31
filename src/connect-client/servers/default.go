package servers

// Copyright (C) 2023 by Posit Software, PBC.

import "os"

func (l *ServerList) loadServerFromEnvironment() {
	serverURL := os.Getenv("CONNECT_SERVER")
	if serverURL != "" {
		server := Server{
			Type:        serverTypeFromURL(serverURL),
			Source:      ServerSourceEnvironment,
			Name:        "default",
			URL:         serverURL,
			Insecure:    (os.Getenv("CONNECT_INSECURE") != ""),
			Certificate: os.Getenv("CONNECT_CERT"),
			ApiKey:      os.Getenv("CONNECT_API_KEY"),
		}
		l.servers = append(l.servers, server)
	}
}
