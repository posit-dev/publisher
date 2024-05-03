package renv

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"testing"

	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type ManifestPackagesSuite struct {
	utiltest.Suite
	testdata util.AbsolutePath
}

func TestManifestPackagesSuite(t *testing.T) {
	suite.Run(t, new(ManifestPackagesSuite))
}

func (s *ManifestPackagesSuite) SetupTest() {
	cwd, err := util.Getwd(nil)
	s.NoError(err)
	s.testdata = cwd.Join("testdata")
}

type mockPackageLister struct {
	mock.Mock
}

func (m *mockPackageLister) ListAvailablePackages(repos []Repository) ([]AvailablePackage, error) {
	args := m.Called(repos)
	pkgs := args.Get(0)
	if pkgs == nil {
		return nil, args.Error(1)
	} else {
		return pkgs.([]AvailablePackage), args.Error(1)
	}
}

func (m *mockPackageLister) GetBioconductorRepos(base util.AbsolutePath) ([]Repository, error) {
	args := m.Called(base)
	repos := args.Get(0)
	if repos == nil {
		return nil, args.Error(1)
	} else {
		return repos.([]Repository), args.Error(1)
	}
}

func (m *mockPackageLister) GetLibPaths() ([]util.AbsolutePath, error) {
	args := m.Called()
	paths := args.Get(0)
	if paths == nil {
		return nil, args.Error(1)
	} else {
		return paths.([]util.AbsolutePath), args.Error(1)
	}
}

func (s *ManifestPackagesSuite) TestCRAN() {
	base := s.testdata.Join("cran_project")
	lockfilePath := base.Join("renv.lock")
	libPath := base.Join("renv_library")
	otherlibPath := util.NewAbsolutePath("/nonexistent", afero.NewMemMapFs())

	mapper := NewPackageMapper(base, util.Path{}, logging.New())
	lister := &mockPackageLister{}
	lister.On("GetLibPaths").Return([]util.AbsolutePath{otherlibPath, libPath}, nil)
	lister.On("GetBioconductorRepos", mock.Anything).Return(nil, nil)
	lister.On("ListAvailablePackages", mock.Anything).Return([]AvailablePackage{
		{
			Name:       "random_package",
			Version:    "4.5.6",
			Repository: "https://cran.example.com",
		},
		{
			Name:       "mypkg",
			Version:    "1.2.3",
			Repository: "https://cran.rstudio.com",
		},
	}, nil)
	mapper.lister = lister

	manifestPackages, err := mapper.GetManifestPackages(base, lockfilePath)
	s.NoError(err)

	var expected bundles.PackageMap
	expectedFile := base.Join("expected.json")
	content, err := expectedFile.ReadFile()
	s.NoError(err)
	err = json.Unmarshal(content, &expected)
	s.NoError(err)

	s.Equal(expected, manifestPackages)
}

func (s *ManifestPackagesSuite) TestBioconductor() {
	base := s.testdata.Join("bioc_project")
	lockfilePath := base.Join("renv.lock")
	libPath := base.Join("renv_library")
	otherlibPath := util.NewAbsolutePath("/nonexistent", afero.NewMemMapFs())

	mapper := NewPackageMapper(base, util.Path{}, logging.New())
	lister := &mockPackageLister{}
	lockfileRepos := []Repository{
		{Name: "CRAN", URL: "https://cran.rstudio.com"},
	}
	biocRepos := []Repository{
		{Name: "BioCsoft", URL: "https://bioconductor.org/packages/3.18/bioc"},
		{Name: "BioCann", URL: "https://bioconductor.org/packages/3.18/data/annotation"},
		{Name: "BioCexp", URL: "https://bioconductor.org/packages/3.18/data/experiment"},
		{Name: "BioCworkflows", URL: "https://bioconductor.org/packages/3.18/workflows"},
		{Name: "BioCbooks", URL: "https://bioconductor.org/packages/3.18/books"},
	}
	lister.On("GetLibPaths").Return([]util.AbsolutePath{otherlibPath, libPath}, nil)
	lister.On("GetBioconductorRepos", mock.Anything).Return(biocRepos, nil)
	lister.On("ListAvailablePackages", lockfileRepos).Return([]AvailablePackage{
		{
			Name:       "random_package",
			Version:    "4.5.6",
			Repository: "https://cran.example.com",
		},
		{
			Name:       "mypkg",
			Version:    "1.2.3",
			Repository: "https://cran.rstudio.com",
		},
	}, nil)
	lister.On("ListAvailablePackages", biocRepos).Return([]AvailablePackage{
		{
			Name:       "bioassayR",
			Version:    "1.40.0",
			Repository: "https://bioconductor.org/packages/3.18/bioc",
		},
		{
			Name:       "Biobase",
			Version:    "2.62.0",
			Repository: "https://bioconductor.org/packages/3.18/bioc",
		},
		{
			Name:       "biobroom",
			Version:    "1.34.0",
			Repository: "https://bioconductor.org/packages/3.18/bioc",
		},
	}, nil)
	mapper.lister = lister

	manifestPackages, err := mapper.GetManifestPackages(base, lockfilePath)
	s.NoError(err)

	var expected bundles.PackageMap
	expectedFile := base.Join("expected.json")
	content, err := expectedFile.ReadFile()
	s.NoError(err)
	err = json.Unmarshal(content, &expected)
	s.NoError(err)

	s.Equal(expected, manifestPackages)
}

// const sampleLockfileFromBioconductor = `
// {
// 	"R": {
// 		"Version": "4.3.0",
// 		"Repositories": [
// 			{
// 				"Name": "CRAN",
// 				"URL": "https://cran.rstudio.com"
// 			}
// 		]
// 	},
// 	"Bioconductor": {
// 		"Version": "3.18"
// 	},
//   	"Packages": {
// 		"Biobase": {
// 			"Package": "Biobase",
// 			"Version": "2.62.0",
// 			"Source": "Bioconductor",
// 			"Requirements": [
// 				"BiocGenerics",
// 				"R",
// 				"methods",
// 				"utils"
// 			],
// 			"Hash": "38252a34e82d3ff6bb46b4e2252d2dce"
// 		}
// 	}
// }
// `

// func (s *ManifestPackagesSuite) TestBioconductor() {
// 	lockfilePath := s.cwd.Join("renv.lock")
// 	err := lockfilePath.WriteFile([]byte(sampleLockfileFromBioconductor), 0666)
// 	s.NoError(err)

// 	libPath := s.cwd.Join("renv", "library", "someplatform")
// 	otherlibPath := s.cwd.Join("nonexistent", "library")

// 	descFilePath := libPath.Join("mypkg", "DESCRIPTION")
// 	err = descFilePath.MkdirAll(0777)
// 	s.NoError(err)
// 	err = descFilePath.WriteFile([]byte(sampleDescription), 0666)
// 	s.NoError(err)

// 	mapper := NewPackageMapper(s.cwd, util.Path{}, logging.New())
// 	lister := &mockPackageLister{}
// 	lister.On("GetLibPaths").Return([]util.AbsolutePath{otherlibPath, libPath}, nil)
// 	lister.On("GetBioconductorRepos", mock.Anything).Return([]Repository{
// 		{Name: "BioCsoft", URL: "https://bioconductor.org/packages/3.18/bioc"},
// 		{Name: "BioCann", URL: "https://bioconductor.org/packages/3.18/data/annotation"},
// 		{Name: "BioCexp", URL: "https://bioconductor.org/packages/3.18/data/experiment"},
// 		{Name: "BioCworkflows", URL: "https://bioconductor.org/packages/3.18/workflows"},
// 		{Name: "BioCbooks", URL: "https://bioconductor.org/packages/3.18/books"},
// 	}, nil)
// 	lister.On("ListAvailablePackages", mock.Anything).Return([]AvailablePackage{
// 		{
// 			Name:       "random_package",
// 			Version:    "4.5.6",
// 			Repository: "https://cran.example.com",
// 		},
// 		{
// 			Name:       "mypkg",
// 			Version:    "1.2.3",
// 			Repository: "https://cran.rstudio.com",
// 		},
// 	}, nil)
// 	mapper.lister = lister

// 	manifestPackages, err := mapper.GetManifestPackages(s.cwd, lockfilePath)
// 	s.NoError(err)
// 	s.Equal(bundles.PackageMap{
// 		"Biobase": bundles.Package{
// 			Source:     "Bioconductor",
// 			Repository: "https://bioconductor.org/packages/3.18/bioc",
// 			Description: dcf.Record{
// 				"Package": "Biobase",
// 				"Title": "Biobase: Base functions for Bioconductor",
// 				"Description": "Functions that are needed by many other packages or which\n        replace R functions.",
// 				"biocViews": "Infrastructure",
// 				"URL": "https://bioconductor.org/packages/Biobase",
// 				"BugReports": "https://github.com/Bioconductor/Biobase/issues",
// 				"Version": "2.62.0",
// 				"License": "Artistic-2.0",
// 				"Authors@R": "c(\n    person(\"R.\", \"Gentleman\", role=\"aut\"),\n    person(\"V.\", \"Carey\", role = \"aut\"),\n    person(\"M.\", \"Morgan\", role=\"aut\"),\n    person(\"S.\", \"Falcon\", role=\"aut\"),\n    person(\"Haleema\", \"Khan\",\n        role = \"ctb\",\n        comment = \"'esApply' and 'BiobaseDevelopment' vignette translation from Sweave to Rmarkdown / HTML\"\n    ),\n    person(\"Bioconductor Package Maintainer\",\n        role = \"cre\",\n        email = \"maintainer@bioconductor.org\"\n    ))",
// 				"Suggests": "tools, tkWidgets, ALL, RUnit, golubEsets, BiocStyle, knitr",
// 				"Depends": "R (>= 2.10), BiocGenerics (>= 0.27.1), utils",
// 				"Imports": "methods",
// 				"VignetteBuilder": "knitr",
// 				"LazyLoad": "yes",
// 				"Collate": "tools.R strings.R environment.R vignettes.R packages.R\nAllGenerics.R VersionsClass.R VersionedClasses.R\nmethods-VersionsNull.R methods-VersionedClass.R DataClasses.R\nmethods-aggregator.R methods-container.R methods-MIAxE.R\nmethods-MIAME.R methods-AssayData.R\nmethods-AnnotatedDataFrame.R methods-eSet.R\nmethods-ExpressionSet.R methods-MultiSet.R methods-SnpSet.R\nmethods-NChannelSet.R anyMissing.R rowOp-methods.R\nupdateObjectTo.R methods-ScalarObject.R zzz.R",
// 				"git_url": "https://git.bioconductor.org/packages/Biobase",
// 				"git_branch": "RELEASE_3_18",
// 				"git_last_commit": "8201fbb",
// 				"git_last_commit_date": "2023-10-24",
// 				"Date/Publication": "2023-10-24",
// 				"NeedsCompilation": "yes",
// 				"Packaged": "2023-10-24 20:27:07 UTC; biocbuild",
// 				"Author": "R. Gentleman [aut],\n  V. Carey [aut],\n  M. Morgan [aut],\n  S. Falcon [aut],\n  Haleema Khan [ctb] ('esApply' and 'BiobaseDevelopment' vignette\n    translation from Sweave to Rmarkdown / HTML),\n  Bioconductor Package Maintainer [cre]",
// 				"Maintainer": "Bioconductor Package Maintainer <maintainer@bioconductor.org>",
// 				"Built": "R 4.3.1; x86_64-apple-darwin20; 2023-10-25 04:36:11 UTC; unix"
// 			  },
// 		},
// 	}, manifestPackages)
// }
