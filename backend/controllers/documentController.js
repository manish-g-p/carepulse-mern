const MedicalDocument = require("../models/MedicalDocument");
const { DOCUMENT_CATEGORIES } = require("../models/MedicalDocument");
const { storeDocument, removeDocumentFile } = require("../services/documentStorage");

const ownerId = (req) => req.auth.doctorId;

// GET /api/documents?category=
const listDocuments = async (req, res) => {
  try {
    const filter = { ownerId: ownerId(req) };
    if (req.query.category) filter.category = req.query.category;
    const documents = await MedicalDocument.find(filter).sort({ createdAt: -1 });
    res.json(documents);
  } catch (error) {
    console.error("listDocuments error:", error);
    res.status(500).json({ message: "Failed to load documents" });
  }
};

// POST /api/documents  multipart: file + { title, category }
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "A file is required" });
    const { title, category } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ message: "A title is required" });
    }
    if (category && !DOCUMENT_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: "Unknown category" });
    }

    const stored = await storeDocument(req.file.buffer, req.file.originalname, req.file.mimetype);
    const document = await MedicalDocument.create({
      ownerId: ownerId(req),
      title: title.trim(),
      category: category || "Other",
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      ...stored,
    });
    res.status(201).json(document);
  } catch (error) {
    console.error("uploadDocument error:", error);
    res.status(500).json({ message: "Failed to upload document" });
  }
};

// DELETE /api/documents/:id -- removes the stored file, then the record.
const deleteDocument = async (req, res) => {
  try {
    const document = await MedicalDocument.findOne({
      _id: req.params.id,
      ownerId: ownerId(req),
    });
    if (!document) return res.status(404).json({ message: "Document not found" });
    await removeDocumentFile(document);
    await document.deleteOne();
    res.json({ message: "Document deleted" });
  } catch (error) {
    console.error("deleteDocument error:", error);
    res.status(500).json({ message: "Failed to delete document" });
  }
};

module.exports = { listDocuments, uploadDocument, deleteDocument };
