// First-pass clinical entity extraction over a transcript: pulls out the
// medications, dosage/timing instructions, and symptoms a patient would want
// on their take-home sheet. Deliberately keyword/pattern based (not an LLM) --
// free, offline, deterministic, and easy for a doctor to sanity-check. Meant
// as an assist, not an authority: it flags candidates, the doctor confirms.

const MEDICATIONS = [
  "paracetamol", "acetaminophen", "ibuprofen", "amoxicillin", "augmentin",
  "azithromycin", "cetirizine", "aspirin", "metformin", "omeprazole",
  "pantoprazole", "dolo", "crocin", "ciprofloxacin", "amlodipine",
  "atorvastatin", "insulin", "antibiotic", "antibiotics", "cough syrup",
  "ors", "vitamin", "antacid", "painkiller", "ointment",
];

const SYMPTOMS = [
  "fever", "cough", "headache", "sore throat", "body ache", "bodyache",
  "nausea", "vomiting", "cold", "runny nose", "fatigue", "tiredness",
  "dizziness", "rash", "diarrhea", "diarrhoea", "constipation",
  "chest pain", "shortness of breath", "breathlessness", "stomach ache",
  "back pain", "joint pain", "swelling", "itching",
];

// Dosage and timing phrasing -- "twice daily", "after food", "every 8 hours",
// "one tablet", "for five days", etc.
const TIMING_PATTERNS = [
  /\b(?:once|twice|thrice|one time|two times|three times)\s+(?:a\s+)?(?:day|daily|week|weekly|night)\b/gi,
  /\bevery\s+\w+\s+hours?\b/gi,
  /\b(?:before|after)\s+(?:food|meals?|breakfast|lunch|dinner)\b/gi,
  /\bat\s+(?:bedtime|night)\b/gi,
  /\bin\s+the\s+morning\b/gi,
  /\bfor\s+\w+\s+(?:days?|weeks?)\b/gi,
  /\b(?:one|two|three|four|1|2|3|4)\s+(?:tablets?|pills?|capsules?|spoons?|drops?)\b/gi,
];

// Whole-word matching, not substring: "ors" must not fire inside "worse",
// nor "cold" inside "scolded". (Found on Day 26 when a reminder suggestion
// appeared for a medication nobody mentioned.)
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const findKeywords = (lowerText, keywords) =>
  keywords.filter((kw) => new RegExp(`\\b${escapeRegex(kw)}\\b`).test(lowerText));

const findPatterns = (text, patterns) => {
  const found = [];
  for (const re of patterns) {
    const matches = text.match(re);
    if (matches) found.push(...matches.map((m) => m.trim().toLowerCase()));
  }
  return found;
};

// Returns { medications, timings, symptoms } -- each a deduped array of the
// phrases detected across all segments.
const extractKeyItems = (segments = []) => {
  const medications = new Set();
  const timings = new Set();
  const symptoms = new Set();

  for (const seg of segments) {
    const text = seg.text || "";
    const lower = text.toLowerCase();
    findKeywords(lower, MEDICATIONS).forEach((m) => medications.add(m));
    findKeywords(lower, SYMPTOMS).forEach((s) => symptoms.add(s));
    findPatterns(text, TIMING_PATTERNS).forEach((t) => timings.add(t));
  }

  return {
    medications: [...medications],
    timings: [...timings],
    symptoms: [...symptoms],
  };
};

module.exports = { extractKeyItems };
