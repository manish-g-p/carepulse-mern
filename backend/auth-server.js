// Auth service: admin passkey login + doctor accounts. Owns the Doctor
// collection in its own database (carepulse_auth). Other services never query
// Doctor -- they trust the JWT (shared JWT_SECRET), keeping auth stateless
// across the split.
const createService = require("./config/createService");
const authRoutes = require("./routes/authRoutes");

createService({
  name: "auth-service",
  dbName: process.env.AUTH_DB || "carepulse_auth",
  port: process.env.AUTH_PORT || 5001,
  mount: (app) => {
    app.use("/api/auth", authRoutes);
  },
});
