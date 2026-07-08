const jwt = require("jsonwebtoken");

// Verifies the bearer token and returns its decoded payload, or null.
const verifyToken = (req) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Protects routes. Pass allowed roles (e.g. requireAuth("doctor", "admin")),
// or call with no args to just require any valid token.
const requireAuth = (...allowedRoles) => (req, res, next) => {
  const decoded = verifyToken(req);
  if (!decoded) {
    return res.status(401).json({ message: "Missing or invalid token" });
  }
  if (allowedRoles.length && !allowedRoles.includes(decoded.role)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  req.auth = decoded;
  next();
};

// Kept for backwards compatibility with existing admin-only routes.
const requireAdmin = (req, res, next) => {
  requireAuth("admin")(req, res, () => {
    req.admin = req.auth;
    next();
  });
};

module.exports = { requireAuth, requireAdmin };
