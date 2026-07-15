// One-time (but idempotent) migration for Day 29: rewrites legacy plaintext
// transcript fields as "enc1:" AES-256-GCM values. Safe to re-run -- already
// encrypted values are skipped by the prefix check. Before touching anything
// it copies the whole collection to conversationsessions_backup_pre_enc in
// the same database (overwritten on re-run, so it always reflects the state
// just before the LAST run).
//
//   node scripts/encryptTranscripts.js        (or npm run migrate:encrypt-transcripts)
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]); // SRV DNS workaround (see HANDOFF)
const { MongoClient } = require("mongodb");
const { encryptText, PREFIX } = require("../services/textCryptoService");

const needsEncryption = (v) => typeof v === "string" && v !== "" && !v.startsWith(PREFIX);

(async () => {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db(process.env.CONVERSATION_DB || "carepulse_conversations");
  const sessions = db.collection("conversationsessions");

  await sessions.aggregate([{ $match: {} }, { $out: "conversationsessions_backup_pre_enc" }]).toArray();
  console.log("backup written: conversationsessions_backup_pre_enc");

  let migrated = 0;
  let untouched = 0;
  for await (const doc of sessions.find({})) {
    const $set = {};
    if (needsEncryption(doc.transcript)) $set.transcript = encryptText(doc.transcript);
    (doc.segments || []).forEach((seg, i) => {
      if (needsEncryption(seg.text)) $set[`segments.${i}.text`] = encryptText(seg.text);
      if (needsEncryption(seg.translatedText)) {
        $set[`segments.${i}.translatedText`] = encryptText(seg.translatedText);
      }
    });

    if (Object.keys($set).length === 0) {
      untouched += 1;
      continue;
    }
    await sessions.updateOne({ _id: doc._id }, { $set });
    migrated += 1;
  }

  console.log(`done: ${migrated} session(s) encrypted, ${untouched} already current`);
  await client.close();
})().catch((e) => {
  console.error("migration failed:", e);
  process.exit(1);
});
