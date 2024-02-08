## Prerendered Shiny: Old Faithful Eruptions

This example was taken from the complete example contained in the R Markdown
article discussing Prerendered Shiny documents at:
<https://rmarkdown.rstudio.com/authoring_shiny_prerendered.html#Complete_Example>

The source for that article lives at:
<https://github.com/rstudio/rmarkdown/blob/bc8348bae45eb8b7b8ee4174b44984608c937bbd/authoring_shiny_prerendered.Rmd>
and its snippet lives at:
<https://github.com/rstudio/rmarkdown/blob/bc8348bae45eb8b7b8ee4174b44984608c937bbd/snippets/shiny_prerendered_complete.md>

Unfortunately, the CRAN release of `packrat` incorrectly identifies the
`index_data` directory as files within the bundle because they are created
as a side-effect of building the bundle (see [rstudio/connect#20212](https://github.com/rstudio/connect/issues/20212)).
This is avoided by using an in-flight changes ([rstudio/packrat#647](https://github.com/rstudio/packrat/pull/647)) that
uses `renv` to perform the code dependency analysis.

```r
remotes::install_github("rstudio/packrat@aron-use-bundle-renv")
```

With this development version of `packrat`, 
the `manifest.json` was created with the command:

```r
rsconnect::writeManifest(appFiles = c("index.Rmd"))
```
