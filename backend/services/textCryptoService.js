const { encryptBuffer, decryptBuffer } = require("./audioCryptoService");

// Field-level encryption for transcript text at rest (Day 29). Same
// AES-256-GCM key and layout as the audio blobs, base64-wrapped with a
// version prefix so values are self-describing:
//
//   "enc1:" + base64([12-byte IV][16-byte tag][ciphertext])
//
// The prefix is what makes migration and rollout safe: decryptText passes
// legacy plaintext through untouched, and encryptText never double-encrypts.
// Wired into the ConversationSession schema as getters/setters, so every
// reader/writer (API, worker, Excel, translation) gets it transparently.
const PREFIX = "enc1:";

const encryptText = (value) => {
  if (typeof value !== "string" || value === "" || value.startsWith(PREFIX)) return value;
  return PREFIX + encryptBuffer(Buffer.from(value, "utf8")).toString("base64");
};

const decryptText = (value) => {
  if (typeof value !== "string" || !value.startsWith(PREFIX)) return value; // legacy plaintext
  try {
    return decryptBuffer(Buffer.from(value.slice(PREFIX.length), "base64")).toString("utf8");
  } catch (error) {
    // Wrong key or corrupt record: fail readable, not throwing from a getter
    // (which would break every list/detail read for the whole session).
    console.error("decryptText failed:", error.message);
    return "[decryption failed]";
  }
};

module.exports = { encryptText, decryptText, PREFIX };
