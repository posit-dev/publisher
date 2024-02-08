from fastapitableau import FastAPITableau
from joblib import load
import pandas as pd
from typing import List

# Load model
model = load("model.joblib")

# Define model_pipline
def model_pipeline(dict):
    model_data = pd.DataFrame(dict)
    model_data["ship_diff"] = (
        model_data.days_to_ship_actual - model_data.days_to_ship_scheduled
    )
    pred_columns = ["ship_diff", "quantity", "sales", "discount"]
    return model.predict(model_data.loc[:, pred_columns]).tolist()


# Define the extension
app = FastAPITableau(
    title="Predicted Profit",
    description="A simple linear prediction of sales profit given new input data",
    version="0.1.0",
)


@app.post("/predict")
async def predict(
    days_to_ship_actual: List[int],
    days_to_ship_scheduled: List[int],
    quantity: List[int],
    sales: List[float],
    discount: List[float],
) -> List[float]:
    data = {
        "days_to_ship_actual": days_to_ship_actual,
        "days_to_ship_scheduled": days_to_ship_scheduled,
        "quantity": quantity,
        "sales": sales,
        "discount": discount,
    }
    return model_pipeline(data)
