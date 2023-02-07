package servers

// Copyright (C) 2023 by Posit Software, PBC.

type Server struct {
	Type        ServerType     // Which type of API this server provides
	Source      ServerSource   // Source of the saved server configuration
	AuthType    ServerAuthType // Authentication method (API key, token, etc)
	Name        string         // Nickname
	URL         string         // Server URL, e.g. https://connect.example.com/rsc
	Insecure    bool           // Skip https server verification
	Certificate string         // Root CA certificate, if server cert is signed by a private CA
	ApiKey      string         // For Connect servers
	AccountName string         // For shinyapps.io and Posit Cloud servers
	Token       string         //   ...
	Secret      string         //   ...
}

type ServerList struct {
	servers []Server
}

func NewServerList() (ServerList, error) {
	serverList := ServerList{
		servers: []Server{},
	}
	err := serverList.Load()
	return serverList, err
}

func (l *ServerList) Load() error {
	l.servers = []Server{}
	l.loadServerFromEnvironment()

	err := l.loadRSConnectPythonServers()
	if err != nil {
		return err
	}
	return nil
}

func (l *ServerList) GetAllServers() []Server {
	return l.servers
}

func (l *ServerList) GetServerByName(name string) (bool, Server) {
	for _, server := range l.servers {
		if server.Name == name {
			return true, server
		}
	}
	return false, Server{}
}

func (l *ServerList) GetServerByURL(url string) (bool, Server) {
	for _, server := range l.servers {
		if server.URL == url {
			return true, server
		}
	}
	return false, Server{}
}
