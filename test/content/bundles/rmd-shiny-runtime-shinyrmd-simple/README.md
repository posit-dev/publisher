## Prerendered Shiny: Hello Prerendered Shiny

This example was taken from the simple example contained in the R Markdown
article discussing Prerendered Shiny documents at:
<https://rmarkdown.rstudio.com/authoring_shiny_prerendered.html#Simple_Example>

The source for that article lives at:
<https://github.com/rstudio/rmarkdown/blob/bc8348bae45eb8b7b8ee4174b44984608c937bbd/authoring_shiny_prerendered.Rmd>
and its snippet lives at:
<https://github.com/rstudio/rmarkdown/blob/bc8348bae45eb8b7b8ee4174b44984608c937bbd/snippets/shiny_prerendered_simple.md>

The `manifest.json` was created with the command:

```r
rsconnect::writeManifest(appFiles = c("index.Rmd"))
```
