from typing import List

from fastapitableau import FastAPITableau

app = FastAPITableau(    
    title="Simple Example",
    description="A *simple* example FastAPITableau app.",
    version="0.1.0",
)


@app.post("/capitalize")
def capitalize(text: List[str]) -> List[str]:
    capitalized = [t.upper() for t in text]
    return capitalized


@app.post("/paste")
def paste(first: List[str], second: List[str]) -> List[str]:
    result = [a + " " + b for a, b in zip(first, second)]
    return result
