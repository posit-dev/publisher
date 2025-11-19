import panel as pn

pn.extension()

def greet(name, intensity):
    return "Hello, " + name + "!" * int(intensity)

name_input = pn.widgets.TextInput(name="Name", value="World")
intensity_slider = pn.widgets.IntSlider(name="Intensity", start=1, end=5, value=1)
greeting_output = pn.bind(greet, name_input, intensity_slider)

app = pn.Column(
    "# Panel Greeting App",
    name_input,
    intensity_slider,
    greeting_output
)

app.servable()
