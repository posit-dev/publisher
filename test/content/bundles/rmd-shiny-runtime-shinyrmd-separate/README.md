## Prerendered Shiny: Old Faithful Waiting Time

This example was inspired by the complete example contained in the R Markdown
article discussing Prerendered Shiny documents at:
<https://rmarkdown.rstudio.com/authoring_shiny_prerendered.html#Complete_Example>

That document was modified to have use the `faithful$waiting` data rather than
`faithful$eruptions` and separates the code into separate `server.R` and `index.Rmd` files.

The source for that article lives at:
<https://github.com/rstudio/rmarkdown/blob/bc8348bae45eb8b7b8ee4174b44984608c937bbd/authoring_shiny_prerendered.Rmd>
and its snippet lives at:
<https://github.com/rstudio/rmarkdown/blob/bc8348bae45eb8b7b8ee4174b44984608c937bbd/snippets/shiny_prerendered_complete.md>

The `manifest.json` was created with the command:

```r
rsconnect::writeManifest(appFiles = c("index.Rmd", "server.R"))
```
