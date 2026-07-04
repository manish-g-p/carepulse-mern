const jwt = require("jsonwebtoken");

// POST /api/auth/admin-login  { passkey }
const adminLogin = (req, res) => {
  const { passkey } = req.body;

  if (!passkey || passkey !== process.env.ADMIN_PASSKEY) {
    return res.status(401).json({ message: "Invalid passkey. Please try again." });
  }

  const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, {
    expiresIn: "12h",
  });

  res.json({ token });
};

module.exports = { adminLogin };
