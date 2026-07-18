const {
  isGeminiConfigured,
  parsePrescriptionImage,
  searchDrugs,
  findAlternatives,
} = require("../services/pharmacyService");

// GET /api/pharmacy/status -- lets the UI hide the image-parsing card when
// no Gemini key is configured (openFDA search needs no key and always shows).
const pharmacyStatus = (req, res) => {
  res.json({ prescriptionParsing: isGeminiConfigured() });
};

// POST /api/pharmacy/prescriptions/parse  multipart: image
const parsePrescription = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "A prescription image is required" });
    if (!req.file.mimetype.startsWith("image/")) {
      return res.status(400).json({ message: "Only image files can be parsed" });
    }
    const medications = await parsePrescriptionImage(req.file.buffer, req.file.mimetype);
    res.json({ medications });
  } catch (error) {
    console.error("parsePrescription error:", error.message);
    res.status(error.status || 500).json({ message: error.message || "Failed to parse prescription" });
  }
};

// GET /api/pharmacy/drugs?q=
const drugSearch = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.status(400).json({ message: "A search term is required" });
    const results = await searchDrugs(q);
    res.json({ results });
  } catch (error) {
    console.error("drugSearch error:", error.message);
    res.status(error.status || 500).json({ message: error.message || "Drug search failed" });
  }
};

// GET /api/pharmacy/drugs/alternatives?name=
const drugAlternatives = async (req, res) => {
  try {
    const name = (req.query.name || "").trim();
    if (!name) return res.status(400).json({ message: "A drug name is required" });
    const result = await findAlternatives(name);
    res.json(result);
  } catch (error) {
    console.error("drugAlternatives error:", error.message);
    res.status(error.status || 500).json({ message: error.message || "Alternative lookup failed" });
  }
};

module.exports = { pharmacyStatus, parsePrescription, drugSearch, drugAlternatives };
