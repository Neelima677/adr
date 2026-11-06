import pandas as pd

def process_csv(file, predict_function):
    df = pd.read_csv(file)

    results = []

    for _, row in df.iterrows():
        review = str(row["review"])

        pred = predict_function(review)

        results.append({
            "review": review,
            "sentiment": pred["sentiment"],
            "adr": pred["adr"],
            "risk": pred["risk"]
        })

    return pd.DataFrame(results)