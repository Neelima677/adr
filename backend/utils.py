import re
import html

ADR_TERMS = [
    "headache", "dizziness", "nausea", "vomiting", "fatigue",
    "sleepiness", "insomnia", "anxiety", "depression", "rash",
    "itching", "diarrhea", "constipation", "dry mouth",
    "weight gain", "weight loss", "stomach pain", "abdominal pain",
    "blurred vision", "palpitations", "shortness of breath",
    "chest pain", "fever", "cough", "swelling", "cramps",
    "loss of appetite", "back pain", "joint pain", "muscle pain",
    "tiredness", "weakness", "irritation", "burning", "heartburn",
    "acne", "hair loss", "sweating", "migraine", "fainting"
]

LABEL_MAP = {
    0: "Negative",
    1: "Neutral",
    2: "Positive"
}


def clean_text(text):
    text = str(text)
    text = html.unescape(text)
    text = text.lower()
    text = re.sub(r"http\S+|www\S+", " ", text)
    text = re.sub(r"[^a-zA-Z0-9\s.,!?%-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def detect_adr_symptoms(text, adr_terms=ADR_TERMS):
    text = str(text).lower()
    found = []

    for term in adr_terms:
        pattern = r"\b" + re.escape(term) + r"\b"
        if re.search(pattern, text):
            found.append(term)

    return sorted(list(set(found)))