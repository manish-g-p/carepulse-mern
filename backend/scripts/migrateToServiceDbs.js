// One-time migration for the Phase 5 per-domain split: COPIES each collection
// from the original monolith database ("carepulse") into the database its
// service now owns. The original database is left untouched as a backup --
// nothing is deleted or modified there. Idempotent: documents are upserted by
// _id, so re-running is safe.
//
// Usage: npm run migrate:service-dbs   (from backend/)

require("dotenv").config();
const dns = require("node:dns");
const { MongoClient } = require("mongoose").mongo;

// Same DNS workaround as config/db.js: some resolvers mishandle the SRV
// lookups that mongodb+srv:// URIs need.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const SOURCE_DB = process.env.SOURCE_DB || "carepulse";

// collection -> destination database (matching each service's default)
const PLAN = {
  doctors: process.env.AUTH_DB || "carepulse_auth",
  users: process.env.PATIENT_DB || "carepulse_patients",
  patients: process.env.PATIENT_DB || "carepulse_patients",
  appointments: process.env.PATIENT_DB || "carepulse_patients",
  conversationsessions: process.env.CONVERSATION_DB || "carepulse_conversations",
  auditlogs: process.env.CONVERSATION_DB || "carepulse_conversations",
};

(async () => {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const source = client.db(SOURCE_DB);

  for (const [collection, destDbName] of Object.entries(PLAN)) {
    const docs = await source.collection(collection).find().toArray();
    if (!docs.length) {
      console.log(`${collection}: nothing to copy`);
      continue;
    }
    const dest = client.db(destDbName).collection(collection);
    let copied = 0;
    for (const doc of docs) {
      await dest.replaceOne({ _id: doc._id }, doc, { upsert: true });
      copied += 1;
    }
    console.log(`${collection}: copied ${copied} -> ${destDbName}`);
  }

  console.log(`Done. Source database "${SOURCE_DB}" was not modified.`);
  await client.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
