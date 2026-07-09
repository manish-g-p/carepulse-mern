"""
Local translation server backed by Meta's NLLB-200 (distilled 600M).

Runs as a small Flask app the Node backend calls over HTTP, exposing the same
shape the previous LibreTranslate integration used (/languages, /translate) so
the Node side barely changes. Chosen over LibreTranslate specifically because
LibreTranslate's Argos catalog does NOT include Kannada, which this project
needs -- NLLB covers English, Hindi, and Kannada (and 200+ others), is free,
open-weight, and ungated on Hugging Face.

Model (~2.4GB) downloads once from Hugging Face on first run, then cached.

Usage:  python translate_server.py       (serves on :5555)
"""

import os

from flask import Flask, jsonify, request
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

MODEL_NAME = "facebook/nllb-200-distilled-600M"
PORT = int(os.environ.get("TRANSLATE_PORT", "5555"))

# Short code (what the API/UI use) -> NLLB FLORES-200 code (what the model uses).
LANGUAGES = {
    "en": {"name": "English", "flores": "eng_Latn"},
    "hi": {"name": "Hindi", "flores": "hin_Deva"},
    "kn": {"name": "Kannada", "flores": "kan_Knda"},
}

print(f"Loading {MODEL_NAME} (first run downloads ~2.4GB)...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)
print("Model loaded. Translation server ready.")

app = Flask(__name__)


@app.get("/languages")
def languages():
    codes = list(LANGUAGES.keys())
    return jsonify(
        [{"code": c, "name": LANGUAGES[c]["name"], "targets": codes} for c in codes]
    )


@app.post("/translate")
def translate():
    body = request.get_json(force=True)
    text = body.get("q", "")
    source = body.get("source")
    target = body.get("target")

    if source not in LANGUAGES or target not in LANGUAGES:
        return jsonify({"error": "Unsupported language code"}), 400
    if not text.strip():
        return jsonify({"translatedText": ""})

    tokenizer.src_lang = LANGUAGES[source]["flores"]
    inputs = tokenizer(text, return_tensors="pt")
    target_token_id = tokenizer.convert_tokens_to_ids(LANGUAGES[target]["flores"])
    generated = model.generate(
        **inputs, forced_bos_token_id=target_token_id, max_length=512
    )
    translated = tokenizer.batch_decode(generated, skip_special_tokens=True)[0]
    return jsonify({"translatedText": translated})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=PORT)
