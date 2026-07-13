const mongoose = require("mongoose");
const dns = require("node:dns");

// Some ISPs/routers/VPNs mishandle DNS SRV lookups, which mongodb+srv:// URIs
// require. Forcing a public resolver avoids "querySrv ECONNREFUSED" errors.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

// Each service connects to its OWN database (per-service data ownership,
// Phase 5): pass the db name to override whatever the URI path says. All
// databases live on the same free Atlas cluster -- separate stores, one
// cluster, still $0.
const connectDB = async (dbName) => {
  try {
    const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/carepulse";
    await mongoose.connect(uri, dbName ? { dbName } : undefined);
    console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
