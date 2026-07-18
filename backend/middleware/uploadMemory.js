const multer = require("multer");
const path = require("path");

// Memory-storage variant of middleware/upload.js for routes that forward the
// file as a buffer (Cloudinary uploads, Gemini prescription parsing) instead
// of keeping it on disk.
const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|svg|webp|pdf/;
  const ok = allowed.test(path.extname(file.originalname).toLowerCase());
  if (ok) return cb(null, true);
  cb(new Error("Unsupported file type"));
};

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

module.exports = uploadMemory;
