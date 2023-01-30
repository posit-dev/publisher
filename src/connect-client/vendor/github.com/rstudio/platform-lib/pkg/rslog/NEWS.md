# `rslog` package 

Unreleased
--------------------------------------------------------------------------------

<!--
### New

*   Uncomment when items are available.
-->

<!--
### Fixed

*   Uncomment when items are available.
-->

<!--
### Breaking

*   Uncomment when items are available.
-->

<!--
### Deprecated / Removed

*   Uncomment when items are available.
-->

<!--
### New Contributors

*   Uncomment when items are available.
-->


pkg/rslog/v1.6.0
--------------------------------------------------------------------------------

### New

*   Log enabled debug logging regions. This was previously done in product by the legacy debug
    implementation. Important to note that intializing debug logging will set and use a default factory
		to `DefaultLoggerFactory`, consider setting `rslog.DefaultLoggerFactory` first before anything else
		when a custom factory is needed. #94

*   New functions `rslog.Buffer` and `rslog.Flush` have been added. They enable buffering functionality for
    default loggers whose factories use `rslog.LoggerImpl` as their implementation.


pkg/rslog/v1.5.0
--------------------------------------------------------------------------------
June 6, 2022

### New
*   Doc updates by @mcbex in #84
*   Enforce UTC conversion in log timestamps #88

### Fixed
*   '-buildvcs=false' for temporary build fix #87


pkg/rslog/v1.4.0
--------------------------------------------------------------------------------
April 11, 2022

### New
*   Do not create log directories. `rslog` is not responsible for default log directories that should already exist or be created via product.


pkg/rslog/v1.3.0
--------------------------------------------------------------------------------
March 1, 2022

### New
*   Add enhanced terminal logging to rslog #62


pkg/rslog/v1.2.0
--------------------------------------------------------------------------------
February 22, 2022

### Fixed
*   Fix concurrent writes to debug callbacks registry


pkg/rslog/v1.1.0
--------------------------------------------------------------------------------
February 2, 2022

### New
*   Removed rslog/debug package by moving debug logic into rslog(API-breaking change) #53

### Fixed
*   Fixed bugs in mocked logger's Fatal implementation #56
*   Fixed debug child loggers not being enabled #55


pkg/rslog/v1.0.0
--------------------------------------------------------------------------------
January 18, 2022

### New
*   Make each rsnotify listener implementation a module #36
*   Split into multiple Go modules #35
*   Use correct Go version in CI #38


## Full Changelog:
- [Unreleased](https://github.com/rstudio/platform-lib/compare/pkg/rslog/v1.5.0...HEAD)
- [1.5.0](https://github.com/rstudio/platform-lib/compare/pkg/rslog/v1.4.0...pkg/rslog/v1.5.0)
- [1.4.0](https://github.com/rstudio/platform-lib/compare/pkg/rslog/v1.3.0...pkg/rslog/v1.4.0)
- [1.3.0](https://github.com/rstudio/platform-lib/compare/pkg/rslog/v1.2.0...pkg/rslog/v1.3.0)
- [1.2.0](https://github.com/rstudio/platform-lib/compare/pkg/rslog/v1.1.0...pkg/rslog/v1.2.0)
- [1.1.0](https://github.com/rstudio/platform-lib/compare/pkg/rslog/v1.0.0...pkg/rslog/v1.1.0)
- [1.0.0](https://github.com/rstudio/platform-lib/compare/v0.1.8...pkg/rslog/v1.0.0)
