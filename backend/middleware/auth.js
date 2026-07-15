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

// Download routes accept EITHER a normal bearer token (the app's own blob
// fetches) OR a short-lived signed URL (?sig=<jwt>, Day 28) minted by the
// download-url endpoint. The signed token pins the exact session and kind
// and embeds the original requester's identity as `actor`, which becomes
// req.auth -- so the controller's ownership scoping and audit logging work
// identically for both transports.
const requireAuthOrSignedUrl = (kind, ...roles) => (req, res, next) => {
  const sig = req.query.sig;
  if (!sig) return requireAuth(...roles)(req, res, next);
  try {
    const decoded = jwt.verify(sig, process.env.JWT_SECRET);
    if (decoded.role !== "download" || decoded.kind !== kind || decoded.sessionId !== req.params.id) {
      throw new Error("scope mismatch");
    }
    req.auth = decoded.actor;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired download link" });
  }
};

module.exports = { requireAuth, requireAdmin, requireAuthOrSignedUrl };
