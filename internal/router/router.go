package router

import (
	"net/http"
	"os"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/rstudio/connect-client/internal/services/api"
	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
)

type Router interface {
	http.Handler
}

func New(afs afero.Fs) Router {

	r := mux.NewRouter()

	// logging
	r.Use(func(next http.Handler) http.Handler {
		return handlers.CombinedLoggingHandler(os.Stdout, next)
	})

	r.HandleFunc("/api/files", api.NewFilesController(afs, rslog.DefaultLogger()))

	return handlers.RecoveryHandler()(r)
}
