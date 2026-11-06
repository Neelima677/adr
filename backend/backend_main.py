import os
import json
import uuid
from pathlib import Path

import torch
import pandas as pd

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from transformers import AutoTokenizer

from backend.model import BioClinicalBERT_BiLSTM_Attention
from backend.utils import clean_text, detect_adr_symptoms, LABEL_MAP
from backend.auth import register_user, login_user


BASE_DIR = Path(__file__).resolve().parent.parent
ASSETS_DIR = BASE_DIR / "assets"
OUTPUT_DIR = BASE_DIR / "outputs"

MODEL_NAME = "emilyalsentzer/Bio_ClinicalBERT"
MAX_LEN = 128

MODEL_PATH = ASSETS_DIR / "best_model.pt"
FINAL_RESULTS_PATH = ASSETS_DIR / "final_results.json"
TRAINING_HISTORY_PATH = ASSETS_DIR / "training_history.json"

OUTPUT_DIR.mkdir(exist_ok=True)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = BioClinicalBERT_BiLSTM_Attention(MODEL_NAME).to(device)
model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
model.eval()

app = FastAPI(title="ADR Sentiment Analysis API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")
app.mount("/outputs", StaticFiles(directory=str(OUTPUT_DIR)), name="outputs")


class ReviewInput(BaseModel):
    drug_name: str
    review_text: str


class AuthInput(BaseModel):
    username: str
    password: str


def load_json_file(path: Path):
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def predict_single_review(drug_name: str, review_text: str):
    clean_review = clean_text(review_text)
    symptoms = detect_adr_symptoms(clean_review)
    adr_present_rule = 1 if len(symptoms) > 0 else 0

    enc = tokenizer(
        clean_review,
        add_special_tokens=True,
        max_length=MAX_LEN,
        padding="max_length",
        truncation=True,
        return_attention_mask=True,
        return_tensors="pt"
    )

    input_ids = enc["input_ids"].to(device)
    attention_mask = enc["attention_mask"].to(device)

    with torch.no_grad():
        sentiment_logits, adr_logits, _ = model(input_ids, attention_mask)

        sentiment_prob = torch.softmax(sentiment_logits, dim=1).cpu().numpy()[0]
        sentiment_pred = int(torch.argmax(sentiment_logits, dim=1).cpu().numpy()[0])

        adr_prob = float(torch.sigmoid(adr_logits).cpu().numpy()[0])
        adr_pred = 1 if adr_prob >= 0.5 else 0

    return {
        "drug_name": drug_name,
        "review_text": review_text,
        "clean_review": clean_review,
        "predicted_sentiment": LABEL_MAP[sentiment_pred],
        "sentiment_probabilities": {
            "negative": float(sentiment_prob[0]),
            "neutral": float(sentiment_prob[1]),
            "positive": float(sentiment_prob[2])
        },
        "adr_present_model": int(adr_pred),
        "adr_probability": float(adr_prob),
        "adr_present_rule_based": int(adr_present_rule),
        "detected_symptoms": symptoms
    }


def get_risk_label(probability: float) -> str:
    if probability < 0.35:
        return "Low Risk"
    elif probability < 0.70:
        return "Moderate Risk"
    return "High Risk"


@app.get("/")
def home():
    return {
        "message": "ADR Sentiment Analysis API is running successfully"
    }


@app.post("/register")
def register(data: AuthInput):
    success, message = register_user(data.username, data.password)
    return {
        "success": success,
        "message": message
    }


@app.post("/login")
def login(data: AuthInput):
    success, message = login_user(data.username, data.password)
    return {
        "success": success,
        "message": message
    }


@app.get("/metrics")
def get_metrics():
    final_results = load_json_file(FINAL_RESULTS_PATH)
    validation_metrics = final_results.get("validation_metrics", {})

    return {
        "model_name": "BioClinicalBERT + BiLSTM + Attention",
        "sentiment_accuracy": round(validation_metrics.get("sentiment_accuracy", 0) * 100, 2),
        "sentiment_precision": round(validation_metrics.get("sentiment_precision", 0) * 100, 2),
        "sentiment_recall": round(validation_metrics.get("sentiment_recall", 0) * 100, 2),
        "sentiment_f1": round(validation_metrics.get("sentiment_f1", 0) * 100, 2),
        "adr_accuracy": round(validation_metrics.get("adr_accuracy", 0) * 100, 2),
        "adr_precision": round(validation_metrics.get("adr_precision", 0) * 100, 2),
        "adr_recall": round(validation_metrics.get("adr_recall", 0) * 100, 2),
        "adr_f1": round(validation_metrics.get("adr_f1", 0) * 100, 2),
        "adr_auc": round(validation_metrics.get("adr_auc", 0) * 100, 2)
        if validation_metrics.get("adr_auc") is not None else None
    }


@app.get("/training-history")
def get_training_history():
    return load_json_file(TRAINING_HISTORY_PATH)


@app.get("/plots")
def get_plots():
    return {
        "sentiment_before": "/assets/sentiment_distribution_before_balancing.png",
        "sentiment_after": "/assets/sentiment_distribution_after_balancing.png",
        "adr_before": "/assets/adr_distribution_before_balancing.png",
        "adr_after": "/assets/adr_distribution_after_balancing.png",
        "top_adr_symptoms": "/assets/top_adr_symptoms.png",
        "adr_roc_curve": "/assets/adr_roc_curve.png",
        "confusion_matrix": "/assets/confusion_matrix.png"
    }


@app.post("/predict")
def predict(data: ReviewInput):
    return predict_single_review(data.drug_name, data.review_text)


@app.post("/predict_csv")
async def predict_csv(file: UploadFile = File(...)):
    try:
        df = pd.read_csv(file.file)
    except Exception:
        return {
            "success": False,
            "message": "Unable to read CSV file"
        }

    review_column = None
    possible_review_columns = ["review", "Review", "review_text", "text"]

    for col in possible_review_columns:
        if col in df.columns:
            review_column = col
            break

    if review_column is None:
        return {
            "success": False,
            "message": "CSV must contain a review column such as: review"
        }

    drug_column = None
    possible_drug_columns = ["drugName", "drug_name", "Drug", "drug"]

    for col in possible_drug_columns:
        if col in df.columns:
            drug_column = col
            break

    outputs = []

    for _, row in df.iterrows():
        review_text = str(row[review_column])
        drug_name = str(row[drug_column]) if drug_column else "unknown_drug"

        result = predict_single_review(drug_name, review_text)

        outputs.append({
            "drug_name": result["drug_name"],
            "review_text": result["review_text"],
            "clean_review": result["clean_review"],
            "predicted_sentiment": result["predicted_sentiment"],
            "negative_probability": result["sentiment_probabilities"]["negative"],
            "neutral_probability": result["sentiment_probabilities"]["neutral"],
            "positive_probability": result["sentiment_probabilities"]["positive"],
            "adr_present_model": result["adr_present_model"],
            "adr_probability": result["adr_probability"],
            "adr_present_rule_based": result["adr_present_rule_based"],
            "risk_level": get_risk_label(result["adr_probability"]),
            "detected_symptoms": ", ".join(result["detected_symptoms"]) if result["detected_symptoms"] else "None"
        })

    output_df = pd.DataFrame(outputs)
    output_filename = f"prediction_output_{uuid.uuid4().hex[:8]}.csv"
    output_path = OUTPUT_DIR / output_filename
    output_df.to_csv(output_path, index=False)

    return {
        "success": True,
        "message": "CSV processed successfully",
        "download_url": f"/outputs/{output_filename}",
        "filename": output_filename,
        "rows_processed": len(output_df)
    }