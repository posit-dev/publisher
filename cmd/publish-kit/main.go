package main

import (
	connect_client "github.com/rstudio/connect-client/internal"
	"github.com/spf13/afero"
)

func main() {
	afs := afero.NewOsFs()
	a := connect_client.NewApplication(afs)
	a.Start()
}
