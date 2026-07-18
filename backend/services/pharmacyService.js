// AI pharmacy assistant backends, both free:
//  - Prescription image parsing via the Gemini API free tier (GEMINI_API_KEY;
//    unset = the endpoint reports itself unavailable and the UI hides it,
//    matching how the translate server degrades).
//  - Drug information + generic alternatives via openFDA (public, no key;
//    an optional OPENFDA_API_KEY raises the rate limit, still free).
// Node 20's built-in fetch -- no new HTTP dependency.

// "gemini-flash-latest" is Google's rolling alias for the current flash
// model. Pinned versions rot fast on the free tier (2.0-flash's free quota
// dropped to zero, 2.5-flash was closed to new keys) -- the alias survives
// that churn.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const OPENFDA_BASE = "https://api.fda.gov/drug/label.json";

const isGeminiConfigured = () => Boolean(process.env.GEMINI_API_KEY);

// Sends the prescription image to Gemini and asks for strict JSON. Returns
// [{ name, dosage, frequency }] -- suggestions only; the user reviews them
// and runs the openFDA search themselves ("AI assists, never decides").
const parsePrescriptionImage = async (buffer, mimeType) => {
  if (!isGeminiConfigured()) {
    throw Object.assign(new Error("Prescription parsing is not configured (set GEMINI_API_KEY)"), {
      status: 503,
    });
  }

  const prompt =
    "You are reading a medical prescription image. Extract every medication " +
    "mentioned. Respond ONLY with a JSON array where each element is an object " +
    'with keys "name" (the medication name as written), "dosage" (e.g. "500mg", ' +
    'empty string if not visible) and "frequency" (e.g. "twice daily", empty ' +
    "string if not visible). If no medications are legible, respond with [].";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: buffer.toString("base64") } },
            ],
          },
        ],
        generationConfig: { response_mime_type: "application/json", temperature: 0 },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    console.error(`[pharmacy] Gemini ${res.status}: ${body.slice(0, 500)}`);
    throw Object.assign(new Error("The AI service could not process this image"), { status: 502 });
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
  let medications;
  try {
    medications = JSON.parse(text);
  } catch {
    // Model wrapped the JSON in prose/fences despite the mime type -- salvage.
    const match = text.match(/\[[\s\S]*\]/);
    medications = match ? JSON.parse(match[0]) : [];
  }
  if (!Array.isArray(medications)) medications = [];
  return medications
    .filter((m) => m && typeof m.name === "string" && m.name.trim())
    .map((m) => ({
      name: m.name.trim(),
      dosage: typeof m.dosage === "string" ? m.dosage.trim() : "",
      frequency: typeof m.frequency === "string" ? m.frequency.trim() : "",
    }));
};

const first = (arr) => (Array.isArray(arr) && arr.length ? arr[0] : "");

// Normalizes one openFDA label result down to the fields the UI shows.
const toDrugInfo = (result) => ({
  id: result.id || "",
  brandName: first(result.openfda?.brand_name),
  genericName: first(result.openfda?.generic_name),
  manufacturer: first(result.openfda?.manufacturer_name),
  route: first(result.openfda?.route),
  purpose: first(result.purpose),
  indications: first(result.indications_and_usage),
  dosage: first(result.dosage_and_administration),
  warnings: first(result.warnings) || first(result.warnings_and_cautions),
  sideEffects: first(result.adverse_reactions),
});

const openFdaSearch = async (searchExpr, limit) => {
  const params = new URLSearchParams({ search: searchExpr, limit: String(limit) });
  if (process.env.OPENFDA_API_KEY) params.set("api_key", process.env.OPENFDA_API_KEY);
  const res = await fetch(`${OPENFDA_BASE}?${params}`);
  if (res.status === 404) return []; // openFDA's "no matches"
  if (!res.ok) {
    console.error(`[pharmacy] openFDA ${res.status}`);
    throw Object.assign(new Error("Drug database is unavailable right now"), { status: 502 });
  }
  const data = await res.json();
  return (data.results || []).map(toDrugInfo);
};

// Quote + escape a user term for an openFDA field query.
const quoted = (term) => `"${term.replace(/["+]/g, " ").trim()}"`;

// openFDA carries US labeling, so international non-proprietary names that
// differ from the US name would return nothing. Map the common ones.
const US_NAME_ALIASES = {
  paracetamol: "acetaminophen",
  adrenaline: "epinephrine",
  noradrenaline: "norepinephrine",
  salbutamol: "albuterol",
  glibenclamide: "glyburide",
  frusemide: "furosemide",
  pethidine: "meperidine",
};

// Search by brand OR generic name (space-separated terms are OR in openFDA).
const searchDrugs = (query, limit = 10) => {
  const terms = [query];
  const alias = US_NAME_ALIASES[query.trim().toLowerCase()];
  if (alias) terms.push(alias);
  const expr = terms
    .map((t) => `openfda.brand_name:${quoted(t)} openfda.generic_name:${quoted(t)}`)
    .join(" ");
  return openFdaSearch(expr, limit);
};

// Generic alternatives: resolve the drug's generic name, then list other
// products sharing that generic ingredient (different brands/manufacturers).
const findAlternatives = async (name, limit = 10) => {
  const matches = await searchDrugs(name, 1);
  if (!matches.length) return { genericName: "", alternatives: [] };
  const genericName = matches[0].genericName;
  if (!genericName) return { genericName: "", alternatives: [] };

  const products = await openFdaSearch(`openfda.generic_name:${quoted(genericName)}`, limit + 5);
  const original = name.trim().toLowerCase();
  const seen = new Set();
  const alternatives = products.filter((p) => {
    const brand = (p.brandName || "").toLowerCase();
    if (!brand || brand === original) return false;
    if (seen.has(brand)) return false;
    seen.add(brand);
    return true;
  });
  return { genericName, alternatives: alternatives.slice(0, limit) };
};

module.exports = { isGeminiConfigured, parsePrescriptionImage, searchDrugs, findAlternatives };
