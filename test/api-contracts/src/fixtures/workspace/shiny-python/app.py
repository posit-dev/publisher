from shiny import App, ui

app_ui = ui.page_fluid(
    ui.h1("Hello Shiny!"),
)


def server(input, output, session):
    pass


app = App(app_ui, server)
