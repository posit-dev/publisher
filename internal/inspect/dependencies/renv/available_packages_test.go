package renv

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"runtime"
	"testing"

	"github.com/posit-dev/publisher/internal/executor"
	"github.com/posit-dev/publisher/internal/executor/executortest"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type AvailablePackagesSuite struct {
	utiltest.Suite
	base util.AbsolutePath
	log  logging.Logger
}

func TestAvailablePackagesSuite(t *testing.T) {
	suite.Run(t, new(AvailablePackagesSuite))
}

func (s *AvailablePackagesSuite) SetupTest() {
	cwd, err := util.Getwd(afero.NewMemMapFs())
	s.NoError(err)
	err = cwd.MkdirAll(0777)
	s.NoError(err)
	s.base = cwd
	s.log = logging.New()
}

func (s *AvailablePackagesSuite) TestListAvailablePackages() {
	setupMockRInterpreter := func(
		base util.AbsolutePath,
		rExecutableParam util.Path,
		log logging.Logger,
		cmdExecutorOverride executor.Executor,
		pathLookerOverride util.PathLooker,
		existsFuncOverride interpreters.ExistsFunc,
	) (interpreters.RInterpreter, error) {
		i := interpreters.NewMockRInterpreter()
		i.On("Init").Return(nil)
		i.On("GetRExecutable").Return("R", nil)
		return i, nil
	}

	lister, err := NewAvailablePackageLister(s.base, util.Path{}, s.log, setupMockRInterpreter, nil)
	s.NoError(err)

	rExecutablePath := util.NewAbsolutePath("R", nil)

	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", rExecutablePath.String(), mock.Anything, s.base, mock.Anything).Return([]byte(
		"pkg1 1.0 https://cran.rstudio.com/src/contrib \npkg2 2.0 https://cran.rstudio.com/src/contrib \n"), []byte{}, nil)
	lister.rExecutor = executor

	pkgs, err := lister.ListAvailablePackages([]Repository{
		{Name: "cran", URL: "https://cran.rstudio.com"},
	}, logging.New())
	s.NoError(err)
	s.Equal([]AvailablePackage{
		{Name: "pkg1", Version: "1.0", Repository: "https://cran.rstudio.com"},
		{Name: "pkg2", Version: "2.0", Repository: "https://cran.rstudio.com"},
	}, pkgs)
}

const biocReposOutput = `BioCsoft https://bioconductor.org/packages/3.18/bioc
BioCann https://bioconductor.org/packages/3.18/data/annotation
BioCexp https://bioconductor.org/packages/3.18/data/experiment
BioCworkflows https://bioconductor.org/packages/3.18/workflows
BioCbooks https://bioconductor.org/packages/3.18/books
`

func (s *AvailablePackagesSuite) TestGetBioconductorRepos() {
	setupMockRInterpreter := func(
		base util.AbsolutePath,
		rExecutableParam util.Path,
		log logging.Logger,
		cmdExecutorOverride executor.Executor,
		pathLookerOverride util.PathLooker,
		existsFuncOverride interpreters.ExistsFunc,
	) (interpreters.RInterpreter, error) {
		i := interpreters.NewMockRInterpreter()
		i.On("Init").Return(nil)
		i.On("GetRExecutable").Return("R", nil)
		return i, nil
	}

	lister, _ := NewAvailablePackageLister(s.base, util.Path{}, s.log, setupMockRInterpreter, nil)
	rExecutablePath := util.NewAbsolutePath("R", nil)

	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", rExecutablePath.String(), mock.Anything, s.base, mock.Anything).Return([]byte(biocReposOutput), []byte{}, nil)
	lister.rExecutor = executor

	repos, err := lister.GetBioconductorRepos(s.base, logging.New())
	s.NoError(err)
	s.Equal([]Repository{
		{Name: "BioCsoft", URL: "https://bioconductor.org/packages/3.18/bioc"},
		{Name: "BioCann", URL: "https://bioconductor.org/packages/3.18/data/annotation"},
		{Name: "BioCexp", URL: "https://bioconductor.org/packages/3.18/data/experiment"},
		{Name: "BioCworkflows", URL: "https://bioconductor.org/packages/3.18/workflows"},
		{Name: "BioCbooks", URL: "https://bioconductor.org/packages/3.18/books"},
	}, repos)
}

const libPathsOutput = `/project/renv/library/R-4.3/x86_64-apple-darwin20
/Users/me/Library/Caches/org.R-project.R/R/renv/sandbox/R-4.3/x86_64-apple-darwin20/b06620f4
`

func (s *AvailablePackagesSuite) TestGetLibPaths() {
	if runtime.GOOS == "windows" {
		s.T().Skip()
	}

	setupMockRInterpreter := func(
		base util.AbsolutePath,
		rExecutableParam util.Path,
		log logging.Logger,
		cmdExecutorOverride executor.Executor,
		pathLookerOverride util.PathLooker,
		existsFuncOverride interpreters.ExistsFunc,
	) (interpreters.RInterpreter, error) {
		i := interpreters.NewMockRInterpreter()
		i.On("Init").Return(nil)
		i.On("GetRExecutable").Return("R", nil)
		return i, nil
	}
	rExecutablePath := util.NewAbsolutePath("R", nil)

	lister, err := NewAvailablePackageLister(s.base, util.NewPath("R", nil), s.log, setupMockRInterpreter, nil)
	s.NoError(err)

	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", rExecutablePath.String(), mock.Anything, s.base, mock.Anything).Return([]byte(libPathsOutput), []byte{}, nil)
	lister.rExecutor = executor

	repos, err := lister.GetLibPaths(logging.New())
	s.NoError(err)
	s.Len(repos, 2)
	s.Equal("/project/renv/library/R-4.3/x86_64-apple-darwin20", repos[0].String())
	s.Equal("/Users/me/Library/Caches/org.R-project.R/R/renv/sandbox/R-4.3/x86_64-apple-darwin20/b06620f4", repos[1].String())
}

const windowsLibPathsOutput = `D:\project\renv\library\R-4.3\x86_64-apple-darwin20
C:\Users\me\AppData\Local\R\Cache\R\renv\sandbox\R-4.3\etc
`

func (s *AvailablePackagesSuite) TestGetLibPathsWindows() {
	if runtime.GOOS != "windows" {
		s.T().Skip()
	}

	setupMockRInterpreter := func(
		base util.AbsolutePath,
		rExecutableParam util.Path,
		log logging.Logger,
		cmdExecutorOverride executor.Executor,
		pathLookerOverride util.PathLooker,
		existsFuncOverride interpreters.ExistsFunc,
	) (interpreters.RInterpreter, error) {
		i := interpreters.NewMockRInterpreter()
		i.On("Init").Return(nil)
		i.On("GetRExecutable").Return("R", nil)
		return i, nil
	}
	rExecutablePath := util.NewAbsolutePath("R", nil)

	lister, err := NewAvailablePackageLister(s.base, util.NewPath("R", nil), s.log, setupMockRInterpreter, nil)
	s.NoError(err)

	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", rExecutablePath, []string{"-s", "-e", "cat(.libPaths(), sep=\"\\n\")"}, s.base, mock.Anything).Return([]byte(windowsLibPathsOutput), []byte{}, nil)
	lister.rExecutor = executor

	repos, err := lister.GetLibPaths(logging.New())
	s.NoError(err)
	s.Len(repos, 2)
	s.Equal(`D:\project\renv\library\R-4.3\x86_64-apple-darwin20`, repos[0].String())
	s.Equal(`C:\Users\me\AppData\Local\R\Cache\R\renv\sandbox\R-4.3\etc`, repos[1].String())
}
