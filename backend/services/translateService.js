// Thin client for the local NLLB translation server (backend/pyservices/
// translate_server.py, started via `npm run setup:translate` then run
// directly). Self-hosted and free -- no API key, no per-request cost.
//
// This replaced an earlier LibreTranslate integration: LibreTranslate's Argos
// catalog does not include Kannada, which this project needs. NLLB-200 covers
// English, Hindi, and Kannada. The HTTP interface here is deliberately the same
// shape LibreTranslate used, so only the server implementation changed.
const TRANSLATE_URL =
  process.env.TRANSLATE_URL || process.env.LIBRETRANSLATE_URL || "http://localhost:5555";

const isTranslationAvailable = async () => {
  try {
    const res = await fetch(`${TRANSLATE_URL}/languages`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
};

const listLanguages = async () => {
  const res = await fetch(`${TRANSLATE_URL}/languages`);
  if (!res.ok) throw new Error(`Translation /languages failed: ${res.status}`);
  return res.json(); // [{ code, name, targets }]
};

const translateText = async (text, source, target) => {
  const res = await fetch(`${TRANSLATE_URL}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: text, source, target, format: "text" }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Translation /translate failed: ${res.status} ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.translatedText;
};

module.exports = { isTranslationAvailable, listLanguages, translateText };
