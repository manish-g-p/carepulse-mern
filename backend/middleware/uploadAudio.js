const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Kept out of backend/uploads (which is served publicly at /uploads) since
// conversation audio is PHI and must only ever be reachable through an
// authenticated, ownership-checked route.
const audioDir = path.join(__dirname, "..", "storage", "audio");
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, audioDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname) || ".webm"}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = /^audio\//;
  const allowedExt = /webm|wav|ogg|mp3|m4a|mp4|aac/;
  const ok = allowedMimeTypes.test(file.mimetype) || allowedExt.test(path.extname(file.originalname).toLowerCase());
  if (ok) return cb(null, true);
  cb(new Error("Unsupported audio type"));
};

const uploadAudio = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB (~ generous for a recorded consultation)
});

module.exports = uploadAudio;
