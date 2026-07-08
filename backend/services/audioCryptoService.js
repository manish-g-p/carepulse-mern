const crypto = require("crypto");

// AES-256-GCM: authenticated encryption (integrity-checked, not just
// confidentiality) for conversation audio at rest. Layout on disk:
// [12-byte IV][16-byte auth tag][ciphertext].
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const getKey = () => {
  const hex = process.env.AUDIO_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "AUDIO_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate one with: " +
        `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
  }
  return Buffer.from(hex, "hex");
};

const encryptBuffer = (buffer) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
};

const decryptBuffer = (encrypted) => {
  const iv = encrypted.subarray(0, IV_LENGTH);
  const authTag = encrypted.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encrypted.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};

module.exports = { encryptBuffer, decryptBuffer };
