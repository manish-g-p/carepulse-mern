const mongoose = require("mongoose");

const DOCUMENT_CATEGORIES = ["Lab Report", "Prescription", "Bill", "Insurance", "Other"];

// An uploaded medical document (report, prescription, bill...). The file
// itself lives either on Cloudinary (when CLOUDINARY_* is configured) or on
// local disk under uploads/documents -- `storage` records which, and the
// fields the delete path needs differ accordingly (publicId vs localName).
const MedicalDocumentSchema = new mongoose.Schema(
  {
    ownerId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, enum: DOCUMENT_CATEGORIES, default: "Other" },
    originalName: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    size: { type: Number, default: 0 },
    storage: { type: String, enum: ["cloudinary", "local"], required: true },
    url: { type: String, required: true },
    publicId: { type: String, default: "" }, // cloudinary only
    resourceType: { type: String, default: "" }, // cloudinary only (image|raw)
    localName: { type: String, default: "" }, // local only (filename under uploads/documents)
  },
  { timestamps: true }
);

module.exports = mongoose.model("MedicalDocument", MedicalDocumentSchema);
module.exports.DOCUMENT_CATEGORIES = DOCUMENT_CATEGORIES;
