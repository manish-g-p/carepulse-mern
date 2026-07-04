const mongoose = require("mongoose");
const dns = require("node:dns");

// Some ISPs/routers/VPNs mishandle DNS SRV lookups, which mongodb+srv:// URIs
// require. Forcing a public resolver avoids "querySrv ECONNREFUSED" errors.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/carepulse";
    await mongoose.connect(uri);
    console.log(`MongoDB connected: ${mongoose.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
