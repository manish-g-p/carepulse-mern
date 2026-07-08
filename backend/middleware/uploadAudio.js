const multer = require("multer");
const path = require("path");

// Uses memoryStorage (not disk) so the raw plaintext audio never touches
// disk unencrypted -- conversationController encrypts req.file.buffer
// before writing anything to backend/storage/audio.
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = /^audio\//;
  const allowedExt = /webm|wav|ogg|mp3|m4a|mp4|aac/;
  const ok = allowedMimeTypes.test(file.mimetype) || allowedExt.test(path.extname(file.originalname).toLowerCase());
  if (ok) return cb(null, true);
  cb(new Error("Unsupported audio type"));
};

const uploadAudio = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB (~ generous for a recorded consultation)
});

module.exports = uploadAudio;
