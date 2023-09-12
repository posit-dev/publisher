package clients

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io/fs"
	"testing"
	"time"

	"github.com/rstudio/connect-client/internal/accounts"
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
	s.Equal(log, client.log)
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
	account := &accounts.Account{}
	timeout := 10 * time.Second
	log := loggingtest.NewMockLogger()

	str := mock.AnythingOfType("string")
	anything := mock.Anything
	log.On("Success", "Done")
	log.On("Info", str)
	log.On("Info", str, str, anything)

	expectedPackages := [][]string{
		{string(installPackage), "wheel", ""},
		{string(installPackage), "setuptools", ""},
		{string(installPackage), "pip", ""},
		{string(downloadPackage), "anyio", "3.6.2"},
		{string(downloadPackage), "argon2-cffi", "21.3.0"},
	}
	for _, pkg := range expectedPackages {
		log.On("Status",
			"Package restore",
			"runtime", pythonRuntime,
			"status", packageStatus(pkg[0]),
			"name", pkg[1],
			"version", pkg[2])
	}
	log.On("WithArgs", str, anything).Return(log)

	client, err := NewConnectClient(account, timeout, log)
	s.NoError(err)
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
				Last: 41,
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
				Last: 52,
			},
			nextOp: events.PublishRestorePythonEnvOp,
		},
		{
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
				Last: 67,
			},
			nextOp: events.PublishRunContentOp,
		},
	}
	op := events.AgentOp
	for _, test := range tests {
		op, err = client.handleTaskUpdate(&test.task, op, log)
		if test.err != nil {
			s.ErrorIs(err, test.err)
		} else {
			s.NoError(err)
		}
		s.Equal(test.nextOp, op)
	}
	log.AssertExpectations(s.T())
}
