package connect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"io/fs"
	"testing"
	"time"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/clients/http_client"
	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/logging/loggingtest"
	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type ConnectClientSuite struct {
	utiltest.Suite
}

func TestConnectClientSuite(t *testing.T) {
	suite.Run(t, new(ConnectClientSuite))
}

func (s *ConnectClientSuite) TestNewConnectClient() {
	account := &accounts.Account{}
	timeout := 10 * time.Second
	log := logging.New()

	client, err := NewConnectClient(account, timeout, log)
	s.NoError(err)
	s.Equal(account, client.account)
	s.NotNil(client.client)
}

func (s *ConnectClientSuite) TestNewConnectClientErr() {
	account := &accounts.Account{
		Certificate: "/nonexistent",
	}
	timeout := 10 * time.Second
	log := logging.New()

	client, err := NewConnectClient(account, timeout, log)
	s.ErrorIs(err, fs.ErrNotExist)
	s.Nil(client)
}

type taskTest struct {
	task   taskDTO         // The task response from the server
	nextOp types.Operation // Expected next state
	err    error           // Expected error
}

func (s *ConnectClientSuite) TestWaitForTask() {
	log := loggingtest.NewMockLogger()

	str := mock.AnythingOfType("string")
	anything := mock.Anything
	log.On("Start", "Building Jupyter notebook...", logging.LogKeyOp, events.PublishRestorePythonEnvOp)
	log.On("Start", "Launching Jupyter notebook...", logging.LogKeyOp, events.PublishRunContentOp)
	log.On("Start", "Bundle created with R version 4.3.0, Python version 3.11.3, and Quarto version 0.9.105 is compatible with environment Local with R version 4.3.1 from /opt/R/4.3.1/bin/R, Python version 3.11.3 from /opt/python/3.11.3/bin/python3.11, and Quarto version 1.3.450 from /opt/quarto/1.3.450/bin/quarto", logging.LogKeyOp, events.PublishRestoreREnvOp)
	log.On("Success", "Done", logging.LogKeyOp, events.PublishRestorePythonEnvOp)
	log.On("Success", "Done", logging.LogKeyOp, events.PublishRunContentOp)
	log.On("Success", "Done", logging.LogKeyOp, events.AgentOp)
	log.On("Info", str, str, anything)

	expectedPackages := []struct {
		rt      packageRuntime
		status  packageStatus
		name    string
		version string
	}{
		{pythonRuntime, installPackage, "wheel", ""},
		{pythonRuntime, installPackage, "setuptools", ""},
		{pythonRuntime, installPackage, "pip", ""},
		{pythonRuntime, downloadPackage, "anyio", "3.6.2"},
		{pythonRuntime, downloadPackage, "argon2-cffi", "21.3.0"},
		{rRuntime, downloadAndInstallPackage, "R6", "2.5.1"},
		{rRuntime, downloadAndInstallPackage, "Rcpp", "1.0.10"},
	}
	for _, pkg := range expectedPackages {
		op := events.PublishRestorePythonEnvOp
		if pkg.rt == rRuntime {
			op = events.PublishRestoreREnvOp
		}
		log.On("Status",
			"Package restore",
			"runtime", pkg.rt,
			"status", pkg.status,
			"name", pkg.name,
			"version", pkg.version,
			logging.LogKeyOp, op)
	}
	taskID := types.TaskID("W3YpnrwUOQJxL5DS")

	tests := []taskTest{
		{
			task: taskDTO{
				Id: taskID,
				Output: []string{
					"Building Jupyter notebook...",
					"Bundle created with Python version 3.11.3 is compatible with environment Local with Python version 3.11.3 from /opt/python/3.11.3/bin/python3.11",
					"Bundle requested Python version 3.11.3; using /opt/python/3.11.3/bin/python3.11 which has version 3.11.3",
					"2023/09/12 12:11:28.545506553 [rsc-session] Content GUID: 04f24082-2396-484b-9839-f810891dce95",
					"2023/09/12 12:11:28.545544671 [rsc-session] Content ID: 24257",
					"2023/09/12 12:11:28.545552006 [rsc-session] Bundle ID: 41367",
					"2023/09/12 12:11:28.545557386 [rsc-session] Job Key: W3YpnrwUOQJxL5DS					",
					"2023/09/12 12:11:28.687716230 Linux distribution: Ubuntu 22.04.2 LTS (jammy)",
					"2023/09/12 12:11:28.689253595 Running as user: uid=1031(rstudio-connect) gid=999(rstudio-connect) groups=999(rstudio-connect)",
					"2023/09/12 12:11:28.689266827 Connect version: 2023.08.0-dev+835",
					"2023/09/12 12:11:28.689299912 LANG: C.UTF-8",
					"2023/09/12 12:11:28.689301087 Working directory: /opt/rstudio-connect/mnt/app					",
				},
				Last: 11,
			},
			nextOp: events.PublishRestorePythonEnvOp,
		},
		{
			task: taskDTO{
				Id: taskID,
				Output: []string{
					"2023/09/12 12:11:28.689309426 Building environment using Python 3.11.3 (main, Jun  4 2023, 22:34:28) [GCC 11.3.0] at /opt/python/3.11.3/bin/python3.11",
					"2023/09/12 12:11:28.704289342 Skipped packages: appnope==0.1.3",
					"2023/09/12 12:11:28.704310687 Creating environment: AbrY5VfQZ5r97HDk5puHtA",
					"2023/09/12 12:11:46.700864736 Requirement already satisfied: pip in ./python/env/lib/python3.11/site-packages (22.3.1)",
					"2023/09/12 12:11:46.985722400 Collecting pip",
					"2023/09/12 12:11:47.051703423   Using cached pip-23.2.1-py3-none-any.whl (2.1 MB)",
					"2023/09/12 12:11:47.069280700 Requirement already satisfied: setuptools in ./python/env/lib/python3.11/site-packages (65.5.0)",
					"2023/09/12 12:11:47.410791493 Collecting setuptools",
					"2023/09/12 12:11:47.425842304   Using cached setuptools-68.2.1-py3-none-any.whl (807 kB)",
					"2023/09/12 12:11:47.433729649 Requirement already satisfied: wheel in /opt/python/3.11.3/lib/python3.11/site-packages (0.41.1)",
					"2023/09/12 12:11:47.487214762 Collecting wheel",
					"2023/09/12 12:11:47.496886789   Using cached wheel-0.41.2-py3-none-any.whl (64 kB)",
					"2023/09/12 12:11:47.648418967 Installing collected packages: wheel, setuptools, pip",
					"2023/09/12 12:11:47.648650446   Attempting uninstall: wheel",
					"2023/09/12 12:11:47.652986893     Found existing installation: wheel 0.41.1",
					"2023/09/12 12:11:47.653521318     Not uninstalling wheel at /opt/python/3.11.3/lib/python3.11/site-packages, outside environment /opt/rstudio-connect/mnt/app/python/env",
					"2023/09/12 12:11:47.653782046     Can't uninstall 'wheel'. No files were found to uninstall.",
					"2023/09/12 12:11:48.144296856   Attempting uninstall: setuptools",
					"2023/09/12 12:11:48.149444749     Found existing installation: setuptools 65.5.0",
					"2023/09/12 12:11:48.550304512     Uninstalling setuptools-65.5.0:",
					"2023/09/12 12:11:48.944303947       Successfully uninstalled setuptools-65.5.0",
					"2023/09/12 12:11:53.789270259   Attempting uninstall: pip",
					"2023/09/12 12:11:53.793350144     Found existing installation: pip 22.3.1",
					"2023/09/12 12:11:54.663642768     Uninstalling pip-22.3.1:",
					"2023/09/12 12:11:54.774633341       Successfully uninstalled pip-22.3.1",
					"2023/09/12 12:12:06.254491799 Successfully installed pip-23.2.1 setuptools-68.2.1 wheel-0.41.2		",
				},
				Last: 37,
			},
			nextOp: events.PublishRestorePythonEnvOp,
		},
		{
			task: taskDTO{
				Id: taskID,
				Output: []string{
					"2023/09/12 12:12:07.965738756 Collecting anyio==3.6.2 (from -r python/requirements.txt (line 1))",
					"2023/09/12 12:12:07.975267843   Using cached anyio-3.6.2-py3-none-any.whl (80 kB)",
					"2023/09/12 12:12:08.083943365 Collecting argon2-cffi==21.3.0 (from -r python/requirements.txt (line 2))",
					"2023/09/12 12:12:08.100883289   Using cached argon2_cffi-21.3.0-py3-none-any.whl (14 kB)",
				},
				Last: 43,
			},
			nextOp: events.PublishRestorePythonEnvOp,
		},
		{
			task: taskDTO{
				Id: taskID,
				Output: []string{
					"2023/09/12 12:12:19.773456111 Installing collected packages: anyio, wcwidth, textwrap3, pure-eval, ptyprocess, pickleshare, mistune, ipython-genutils, fastjsonschema, executing, backcall, widgetsnbextension, websocket-client, webcolors, urllib3, uri-template, traitlets, tqdm, tornado, tinycss2, testpath, tenacity, soupsieve, sniffio, six, Send2Trash, rfc3986-validator, pyzmq, PyYAML, python-json-logger, pyrsistent, pyparsing, Pygments, pycparser, psutil, prompt-toolkit, prometheus-client, platformdirs, pexpect, parso, pandocfilters, packaging, nest-asyncio, MarkupSafe, jupyterlab-widgets, jupyterlab-pygments, jsonpointer, idna, fqdn, entrypoints, defusedxml, decorator, debugpy, click, charset-normalizer, certifi, attrs, ansiwrap, terminado, rfc3339-validator, requests, QtPy, python-dateutil, matplotlib-inline, jupyter_core, jsonschema, Jinja2, jedi, comm, cffi, bleach, beautifulsoup4, asttokens, anyio, stack-data, nbformat, jupyter_server_terminals, jupyter_client, arrow, argon2-cffi-bindings, nbclient, isoduration, ipython, argon2-cffi, papermill, nbconvert, ipykernel, qtconsole, jupyter-events, jupyter-console, ipywidgets, jupyter_server, notebook_shim, nbclassic, notebook, jupyter",
					"2023/09/12 12:13:38.459203951 Successfully installed Jinja2-3.1.2 MarkupSafe-2.1.2 PyYAML-6.0 Pygments-2.15.1 QtPy-2.3.1 Send2Trash-1.8.2 ansiwrap-0.8.4 anyio-3.6.2 argon2-cffi-21.3.0 argon2-cffi-bindings-21.2.0 arrow-1.2.3 asttokens-2.2.1 attrs-23.1.0 backcall-0.2.0 beautifulsoup4-4.12.2 bleach-6.0.0 certifi-2023.7.22 cffi-1.15.1 charset-normalizer-3.2.0 click-8.1.7 comm-0.1.3 debugpy-1.6.7 decorator-5.1.1 defusedxml-0.7.1 entrypoints-0.4 executing-1.2.0 fastjsonschema-2.16.3 fqdn-1.5.1 idna-3.4 ipykernel-6.23.0 ipython-8.13.2 ipython-genutils-0.2.0 ipywidgets-8.0.6 isoduration-20.11.0 jedi-0.18.2 jsonpointer-2.3 jsonschema-4.17.3 jupyter-1.0.0 jupyter-console-6.6.3 jupyter-events-0.6.3 jupyter_client-8.2.0 jupyter_core-5.3.0 jupyter_server-2.5.0 jupyter_server_terminals-0.4.4 jupyterlab-pygments-0.2.2 jupyterlab-widgets-3.0.7 matplotlib-inline-0.1.6 mistune-2.0.5 nbclassic-1.0.0 nbclient-0.7.4 nbconvert-7.4.0 nbformat-5.8.0 nest-asyncio-1.5.6 notebook-6.5.4 notebook_shim-0.2.3 packaging-23.1 pandocfilters-1.5.0 papermill-2.4.0 parso-0.8.3 pexpect-4.8.0 pickleshare-0.7.5 platformdirs-3.5.1 prometheus-client-0.16.0 prompt-toolkit-3.0.38 psutil-5.9.5 ptyprocess-0.7.0 pure-eval-0.2.2 pycparser-2.21 pyparsing-3.0.9 pyrsistent-0.19.3 python-dateutil-2.8.2 python-json-logger-2.0.7 pyzmq-25.0.2 qtconsole-5.4.3 requests-2.31.0 rfc3339-validator-0.1.4 rfc3986-validator-0.1.1 six-1.16.0 sniffio-1.3.0 soupsieve-2.4.1 stack-data-0.6.2 tenacity-8.2.3 terminado-0.17.1 testpath-0.6.0 textwrap3-0.9.2 tinycss2-1.2.1 tornado-6.3.1 tqdm-4.66.1 traitlets-5.9.0 uri-template-1.2.0 urllib3-2.0.4 wcwidth-0.2.6 webcolors-1.13 webencodings-0.5.1 websocket-client-1.5.1 widgetsnbextension-4.0.7",
					"2023/09/12 12:13:40.684793490 Packages in the environment: ansiwrap==0.8.4, anyio==3.6.2, argon2-cffi==21.3.0, argon2-cffi-bindings==21.2.0, arrow==1.2.3, asttokens==2.2.1, attrs==23.1.0, backcall==0.2.0, beautifulsoup4==4.12.2, bleach==6.0.0, certifi==2023.7.22, cffi==1.15.1, charset-normalizer==3.2.0, click==8.1.7, comm==0.1.3, debugpy==1.6.7, decorator==5.1.1, defusedxml==0.7.1, entrypoints==0.4, executing==1.2.0, fastjsonschema==2.16.3, fqdn==1.5.1, idna==3.4, ipykernel==6.23.0, ipython==8.13.2, ipython-genutils==0.2.0, ipywidgets==8.0.6, isoduration==20.11.0, jedi==0.18.2, Jinja2==3.1.2, jsonpointer==2.3, jsonschema==4.17.3, jupyter==1.0.0, jupyter-console==6.6.3, jupyter-events==0.6.3, jupyter_client==8.2.0, jupyter_core==5.3.0, jupyter_server==2.5.0, jupyter_server_terminals==0.4.4, jupyterlab-pygments==0.2.2, jupyterlab-widgets==3.0.7, MarkupSafe==2.1.2, matplotlib-inline==0.1.6, mistune==2.0.5, nbclassic==1.0.0, nbclient==0.7.4, nbconvert==7.4.0, nbformat==5.8.0, nest-asyncio==1.5.6, notebook==6.5.4, notebook_shim==0.2.3, packaging==23.1, pandocfilters==1.5.0, papermill==2.4.0, parso==0.8.3, pexpect==4.8.0, pickleshare==0.7.5, platformdirs==3.5.1, prometheus-client==0.16.0, prompt-toolkit==3.0.38, psutil==5.9.5, ptyprocess==0.7.0, pure-eval==0.2.2, pycparser==2.21, Pygments==2.15.1, pyparsing==3.0.9, pyrsistent==0.19.3, python-dateutil==2.8.2, python-json-logger==2.0.7, PyYAML==6.0, pyzmq==25.0.2, qtconsole==5.4.3, QtPy==2.3.1, requests==2.31.0, rfc3339-validator==0.1.4, rfc3986-validator==0.1.1, Send2Trash==1.8.2, six==1.16.0, sniffio==1.3.0, soupsieve==2.4.1, stack-data==0.6.2, tenacity==8.2.3, terminado==0.17.1, testpath==0.6.0, textwrap3==0.9.2, tinycss2==1.2.1, tornado==6.3.1, tqdm==4.66.1, traitlets==5.9.0, uri-template==1.2.0, urllib3==2.0.4, wcwidth==0.2.6, webcolors==1.13, webencodings==0.5.1, websocket-client==1.5.1, widgetsnbextension==4.0.7,",
					"2023/09/12 12:13:40.684844104 Creating kernel spec: python3",
					"2023/09/12 12:13:42.493712394 0.00s - Debugger warning: It seems that frozen modules are being used, which may",
					"2023/09/12 12:13:42.493725446 0.00s - make the debugger miss breakpoints. Please pass -Xfrozen_modules=off",
					"2023/09/12 12:13:42.493763373 0.00s - to python to disable frozen modules.",
					"2023/09/12 12:13:42.493764977 0.00s - Note: Debugging will proceed. Set PYDEVD_DISABLE_FILE_VALIDATION=1 to disable this validation.",
					"2023/09/12 12:13:42.787686354 Installed kernelspec python3 in /opt/rstudio-connect/mnt/app/python/env/share/jupyter/kernels/python3",
					"2023/09/12 12:13:42.994165519 Creating lockfile: python/requirements.txt.lock",
					"Completed Python build against Python version: '3.11.3'		",
				},
				Last: 54,
			},
			nextOp: events.PublishRestorePythonEnvOp,
		},
		{
			// This doesn't really make sense to come next,
			// in fact it is from a different log, but here it is anyway.
			task: taskDTO{
				Id: taskID,
				Output: []string{
					"Launching Jupyter notebook...",
					"Using environment Local",
					"2023/09/12 12:13:44.541508100 [rsc-session] Content GUID: 04f24082-2396-484b-9839-f810891dce95",
					"2023/09/12 12:13:44.541629598 [rsc-session] Content ID: 24257",
					"2023/09/12 12:13:44.541635566 [rsc-session] Bundle ID: 41367",
					"2023/09/12 12:13:44.541639071 [rsc-session] Variant ID: 5921",
					"2023/09/12 12:13:44.541642353 [rsc-session] Job Key: l6FJXo5Ip5C4jyDf",
					"2023/09/12 12:13:44.701717371 Running on host: dogfood02",
					"2023/09/12 12:13:44.713132676 Linux distribution: Ubuntu 22.04.2 LTS (jammy)",
					"2023/09/12 12:13:44.714771923 Running as user: uid=1031(rstudio-connect) gid=999(rstudio-connect) groups=999(rstudio-connect)",
					"2023/09/12 12:13:44.714781982 Connect version: 2023.08.0-dev+835",
					"2023/09/12 12:13:44.714807857 LANG: C.UTF-8",
					"2023/09/12 12:13:44.714811167 Working directory: /opt/rstudio-connect/mnt/app",
					"2023/09/12 12:13:44.714819234 Bootstrapping environment using Python 3.11.3 (main, Jun  4 2023, 22:34:28) [GCC 11.3.0] at /opt/python/3.11.3/bin/python3.11",
					"2023/09/12 12:13:44.716751212 Running content with the Python virtual environment /opt/rstudio-connect/mnt/app/python/env (/opt/rstudio-connect/mnt/python-environments/pip/3.11.3/AbrY5VfQZ5r97HDk5puHtA)				},",
				},
				Finished: true,
				Last:     69,
			},
			nextOp: events.PublishRunContentOp,
		},

		{
			task: taskDTO{
				Id: taskID,
				Output: []string{
					"Bundle created with R version 4.3.0, Python version 3.11.3, and Quarto version 0.9.105 is compatible with environment Local with R version 4.3.1 from /opt/R/4.3.1/bin/R, Python version 3.11.3 from /opt/python/3.11.3/bin/python3.11, and Quarto version 1.3.450 from /opt/quarto/1.3.450/bin/quarto",
					"Bundle requested R version 4.3.0; using /opt/R/4.3.1/bin/R which has version 4.3.1",
					"Performing manifest.json to packrat transformation.",
					"Rewriting .Rprofile to disable renv activation.",
					"2023/09/12 17:02:42.966434822 [rsc-session] Content GUID: 067f9077-b831-4cff-bcd2-ee0797f27cb8",
					"2023/09/12 17:02:42.966484486 [rsc-session] Content ID: 24275",
					"2023/09/12 17:02:42.966491187 [rsc-session] Bundle ID: 41387",
					"2023/09/12 17:02:42.966495586 [rsc-session] Job Key: MjLGWJMm4mkQCxRo",
					"2023/09/12 17:02:44.214759306 Running on host: dogfood01",
					"2023/09/12 17:02:44.240099958 Linux distribution: Ubuntu 22.04.2 LTS (jammy)",
					"2023/09/12 17:02:44.243027005 Running as user: uid=1031(rstudio-connect) gid=999(rstudio-connect) groups=999(rstudio-connect)",
					"2023/09/12 17:02:44.243096083 Connect version: 2023.08.0-dev+835",
					"2023/09/12 17:02:44.243134910 LANG: C.UTF-8",
					"2023/09/12 17:02:44.243454938 Working directory: /opt/rstudio-connect/mnt/app",
					"2023/09/12 17:02:44.243650732 Using R 4.3.1",
					"2023/09/12 17:02:44.243656003 R.home(): /opt/R/4.3.1/lib/R",
					"2023/09/12 17:02:44.244676467 Using user agent string: 'RStudio R (4.3.1 x86_64-pc-linux-gnu x86_64 linux-gnu)'",
					"2023/09/12 17:02:44.245211912 # Validating R library read / write permissions --------------------------------",
					"2023/09/12 17:02:44.249695973 Using R library for packrat bootstrap: /opt/rstudio-connect/mnt/R/4.3.1",
					"2023/09/12 17:02:44.250108685 # Validating managed packrat installation --------------------------------------",
					"2023/09/12 17:02:44.250391017 Vendored packrat archive: /opt/rstudio-connect/ext/R/packrat_0.9.1-1_ac6bc33bce3869513cbe1ce14a697dfa807d9c41.tar.gz",
					"2023/09/12 17:02:44.262948547 Vendored packrat SHA: ac6bc33bce3869513cbe1ce14a697dfa807d9c41",
					"2023/09/12 17:02:44.276923165 Managed packrat SHA:  ac6bc33bce3869513cbe1ce14a697dfa807d9c41",
					"2023/09/12 17:02:44.278612673 Managed packrat version: 0.9.1.1",
					"2023/09/12 17:02:44.279320329 Managed packrat is up-to-date.",
					"2023/09/12 17:02:44.279664142 # Validating packrat cache read / write permissions ----------------------------",
					"2023/09/12 17:02:44.643930307 Using packrat cache directory: /opt/rstudio-connect/mnt/packrat/4.3.1",
					"2023/09/12 17:02:44.644104262 # Setting packrat options and preparing lockfile -------------------------------",
					"2023/09/12 17:02:44.807459260 Audited package hashes with local packrat installation.",
					"2023/09/12 17:02:44.809608665 # Resolving R package repositories ---------------------------------------------",
					"2023/09/12 17:02:44.827081713 Received repositories from Connect's configuration:",
					`2023/09/12 17:02:44.827696151 - CRAN = "https://packagemanager.posit.co/cran/__linux__/jammy/latest"`,
					`2023/09/12 17:02:44.827703834 - RSPM = "https://packagemanager.posit.co/cran/__linux__/jammy/latest"`,
					"2023/09/12 17:02:45.034481466 Received repositories from published content:",
					`2023/09/12 17:02:45.036517369 - CRAN = "https://cran.rstudio.com"`,
					"2023/09/12 17:02:45.041604661 Combining repositories from configuration and content.",
					"2023/09/12 17:02:45.041811490 Packages will be installed using the following repositories:",
					`2023/09/12 17:02:45.042593774 - CRAN = "https://packagemanager.posit.co/cran/__linux__/jammy/latest"`,
					`2023/09/12 17:02:45.042601638 - RSPM = "https://packagemanager.posit.co/cran/__linux__/jammy/latest"`,
					`2023/09/12 17:02:45.042624054 - CRAN.1 = "https://cran.rstudio.com"`,
					"2023/09/12 17:02:45.061047966 # Installing required R packages with `packrat::restore()` ---------------------",
					"2023/09/12 17:02:45.096309315 Warning in packrat::restore(overwrite.dirty = TRUE, prompt = FALSE, restart = FALSE) :",
					"2023/09/12 17:02:45.096320185   The most recent snapshot was generated using R version 4.3.0",
					"2023/09/12 17:02:45.141302848 Installing R6 (2.5.1) ...",
					"2023/09/12 17:02:45.177720769 Using cached R6.",
					"2023/09/12 17:02:45.179592403 	OK (symlinked cache)",
					"2023/09/12 17:02:45.179785920 Installing Rcpp (1.0.10) ...",
					"2023/09/12 17:02:45.224715974 Using cached Rcpp.",
					"2023/09/12 17:02:45.227149420 	OK (symlinked cache)",
					"Completed packrat build against R version: '4.3.1'",
				},
				Last: 119,
			},
			nextOp: events.PublishRestoreREnvOp,
		},
	}
	op := events.AgentOp
	var err error

	for _, test := range tests {
		op, err = handleTaskUpdate(&test.task, op, log)
		if test.err != nil {
			s.ErrorIs(err, test.err)
		} else {
			s.NoError(err)
		}
		s.Equal(test.nextOp, op)
	}
	log.AssertExpectations(s.T())
}

func (s *ConnectClientSuite) TestWaitForTaskErr() {
	log := loggingtest.NewMockLogger()

	str := mock.AnythingOfType("string")
	anything := mock.Anything

	log.On("Start", "Building Jupyter notebook...", logging.LogKeyOp, events.PublishRestorePythonEnvOp)
	log.On("Info", str, str, anything)

	msg := "An error occurred while building your content. (Error code: python-package-version-not-available)"
	task := taskDTO{
		Id: types.TaskID("W3YpnrwUOQJxL5DS"),
		Output: []string{
			"Building Jupyter notebook...",
			"Bundle created with Python version 3.11.3 is compatible with environment Local with Python version 3.11.3 from /opt/python/3.11.3/bin/python3.11",
			"Bundle requested Python version 3.11.3; using /opt/python/3.11.3/bin/python3.11 which has version 3.11.3",
			"2024/01/09 11:20:47 AM: ERROR: Could not find a version that satisfies the requirement nonexistent (from versions: none) 2024/01/09 11:20:47 AM: ERROR: No matching distribution found for nonexistent",
			"2024/01/09 11:20:51 AM: pip install failed with exit code 1",
		},
		Finished: true,
		Error:    msg,
		Last:     5,
	}

	op := events.Operation("")
	op, err := handleTaskUpdate(&task, op, log)
	s.Equal(&types.AgentError{
		Code:    events.DeploymentFailedCode,
		Err:     errors.New(msg),
		Message: msg,
		Data: types.ErrorData{
			"ConnectErrorCode":  "python-package-version-not-available",
			"DocumentationLink": "https://docs.posit.co/connect/user/troubleshooting/#python-package-version-not-available",
		},
		Op: events.PublishRestorePythonEnvOp,
	}, err)
	s.Equal(events.PublishRestorePythonEnvOp, op)
	log.AssertExpectations(s.T())
}

func (s *ConnectClientSuite) TestValidateDeployment() {
	httpClient := &http_client.MockHTTPClient{}
	httpClient.On("GetRaw", mock.Anything, mock.Anything).Return(nil, nil)

	client := &ConnectClient{
		client:  httpClient,
		account: &accounts.Account{},
	}
	contentID := types.ContentID("myContentID")
	err := client.ValidateDeployment(contentID, logging.New())
	s.NoError(err)
}

func (s *ConnectClientSuite) TestValidateDeploymentNonHTTPErr() {
	httpClient := &http_client.MockHTTPClient{}
	testError := errors.New("test error from GetRaw")
	httpClient.On("GetRaw", mock.Anything, mock.Anything).Return(nil, testError)

	client := &ConnectClient{
		client:  httpClient,
		account: &accounts.Account{},
	}
	contentID := types.ContentID("myContentID")
	err := client.ValidateDeployment(contentID, logging.New())
	s.ErrorIs(err, testError)
}

func (s *ConnectClientSuite) TestValidateDeploymentAppFailure() {
	httpClient := &http_client.MockHTTPClient{}
	httpErr := &http_client.HTTPError{
		Status: 502,
	}
	agentError := types.NewAgentError(events.ServerErrorCode, httpErr, nil)
	httpClient.On("GetRaw", mock.Anything, mock.Anything).Return(nil, agentError)

	client := &ConnectClient{
		client:  httpClient,
		account: &accounts.Account{},
	}
	contentID := types.ContentID("myContentID")
	err := client.ValidateDeployment(contentID, logging.New())
	s.ErrorIs(err, agentError)
}

func (s *ConnectClientSuite) TestValidateDeploymentHTTPNonAppErr() {
	httpClient := &http_client.MockHTTPClient{}
	httpErr := &http_client.HTTPError{
		Status: 405,
	}
	agentError := types.NewAgentError(events.ServerErrorCode, httpErr, nil)
	httpClient.On("GetRaw", mock.Anything, mock.Anything).Return(nil, agentError)

	client := &ConnectClient{
		client:  httpClient,
		account: &accounts.Account{},
	}
	contentID := types.ContentID("myContentID")
	err := client.ValidateDeployment(contentID, logging.New())
	s.NoError(err)
}

func (s *ConnectClientSuite) TestTestAuthentication() {
	httpClient := &http_client.MockHTTPClient{}
	expectedUser := &User{
		Id:        types.UserID("40d1c1dc-d554-4905-99f1-359517e1a7c0"),
		Username:  "bob",
		FirstName: "Bob",
		LastName:  "Bobberson",
		Email:     "bob@example.com",
	}

	httpClient.On("Get", "/__api__/v1/user", mock.Anything, mock.Anything).Return(nil).RunFn = func(args mock.Arguments) {
		user := args.Get(1).(*UserDTO)
		*user = UserDTO{
			Email:     expectedUser.Email,
			Username:  expectedUser.Username,
			FirstName: expectedUser.FirstName,
			LastName:  expectedUser.LastName,
			UserRole:  "publisher",
			Confirmed: true,
			Locked:    false,
			GUID:      expectedUser.Id,
		}
	}

	client := &ConnectClient{
		client:  httpClient,
		account: &accounts.Account{},
	}
	user, err := client.TestAuthentication(logging.New())
	s.Equal(expectedUser, user)
	s.NoError(err)
}

func (s *ConnectClientSuite) TestTestAuthentication404() {
	httpClient := &http_client.MockHTTPClient{}
	httpErr := &http_client.HTTPError{
		Status: 404,
	}
	agentError := types.NewAgentError(events.ServerErrorCode, httpErr, nil)
	httpClient.On("Get", "/__api__/v1/user", mock.Anything, mock.Anything).Return(agentError)

	client := &ConnectClient{
		client:  httpClient,
		account: &accounts.Account{},
	}
	user, err := client.TestAuthentication(logging.New())
	s.Nil(user)
	s.NotNil(err)
	s.ErrorIs(err, errInvalidServerOrCredentials)
}

func (s *ConnectClientSuite) TestTestAuthenticationLocked() {
	httpClient := &http_client.MockHTTPClient{}
	httpClient.On("Get", "/__api__/v1/user", mock.Anything, mock.Anything).Return(nil).RunFn = func(args mock.Arguments) {
		user := args.Get(1).(*UserDTO)
		user.Username = "bob"
		user.Locked = true
	}

	client := &ConnectClient{
		client:  httpClient,
		account: &accounts.Account{},
	}
	user, err := client.TestAuthentication(logging.New())
	s.Nil(user)
	s.NotNil(err)
	s.ErrorContains(err, "user account bob is locked")
}

func (s *ConnectClientSuite) TestTestAuthenticationNotConfirmed() {
	httpClient := &http_client.MockHTTPClient{}
	httpClient.On("Get", "/__api__/v1/user", mock.Anything, mock.Anything).Return(nil).RunFn = func(args mock.Arguments) {
		user := args.Get(1).(*UserDTO)
		user.Username = "bob"
		user.Confirmed = false
	}

	client := &ConnectClient{
		client:  httpClient,
		account: &accounts.Account{},
	}
	user, err := client.TestAuthentication(logging.New())
	s.Nil(user)
	s.NotNil(err)
	s.ErrorContains(err, "user account bob is not confirmed")
}

func (s *ConnectClientSuite) TestTestAuthenticationNotPublisher() {
	httpClient := &http_client.MockHTTPClient{}
	httpClient.On("Get", "/__api__/v1/user", mock.Anything, mock.Anything).Return(nil).RunFn = func(args mock.Arguments) {
		user := args.Get(1).(*UserDTO)
		user.Username = "bob"
		user.Confirmed = true
		user.UserRole = "viewer"
	}

	client := &ConnectClient{
		client:  httpClient,
		account: &accounts.Account{},
	}
	user, err := client.TestAuthentication(logging.New())
	s.Nil(user)
	s.NotNil(err)
	s.ErrorContains(err, "user account bob with role 'viewer' does not have permission to publish content")
}
