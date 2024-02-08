# RStudio R Markdown Shiny document with multiple sub-applications.

This project contains an R Markdown document using the Shiny runtime. 
The contents of [`index.Rmd`](index.Rmd) contain the default content as produced
by the RStudio IDE new file dialog. That document was then augmented to include
an additional embedded application.

The initial RStudio source for this document lives at:
<https://github.com/rstudio/rstudio/blob/89f5e409abb8bcf4b0ee68c9ae25cf1cc8cb3844/src/cpp/session/resources/templates/shiny.Rmd>

The `manifest.json` was created with the command:

```r
rsconnect::writeManifest(appFiles = c("index.Rmd"))
```
