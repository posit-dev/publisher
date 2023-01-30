package servers

type ServerType string

const (
	ServerTypeConnect     = "connect"
	ServerTypeShinyappsIO = "shinyapps"
	ServerTypeCloud       = "cloud"
)

func (t ServerType) String() string {
	switch t {
	case ServerTypeConnect:
		return "Posit Connect"
	case ServerTypeShinyappsIO:
		return "shinyapps.io"
	case ServerTypeCloud:
		return "Posit Cloud"
	default:
		return string(t)
	}
}

type Server struct {
	Type        ServerType // Which type of API this server provides
	Name        string     // Nickname
	URL         string     // Server URL, e.g. https://connect.example.com/rsc
	Insecure    bool       // Skip https server verification
	Certificate string     // Root CA certificate, if server cert is signed by a private CA
	ApiKey      string     // For Connect servers
	AccountName string     // For shinyapps.io and Posit Cloud servers
	Token       string     //   ...
	Secret      string     //   ...
}

type ServerList []Server
