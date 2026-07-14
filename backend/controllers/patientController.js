const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Patient = require("../models/Patient");

// POST /api/users  { name, email, phone }
const createUser = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email || !phone) {
      return res.status(400).json({ message: "name, email and phone are required" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.json(existing);
    }

    const user = await User.create({ name, email, phone });
    res.status(201).json(user);
  } catch (error) {
    console.error("createUser error:", error);
    res.status(500).json({ message: "Failed to create user" });
  }
};

// GET /api/users/:userId
const getUser = async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.params.userId });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("getUser error:", error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
};

// POST /api/patients  (multipart/form-data, field name: identificationDocument)
const registerPatient = async (req, res) => {
  try {
    const body = { ...req.body };

    // booleans arrive as strings from multipart/form-data
    ["privacyConsent", "treatmentConsent", "disclosureConsent"].forEach((key) => {
      if (typeof body[key] === "string") body[key] = body[key] === "true";
    });

    if (req.file) {
      body.identificationDocumentId = req.file.filename;
      body.identificationDocumentUrl = `/uploads/${req.file.filename}`;
    }

    const patient = await Patient.create(body);
    res.status(201).json(patient);
  } catch (error) {
    console.error("registerPatient error:", error);
    res.status(500).json({ message: "Failed to register patient" });
  }
};

// GET /api/users/lookup?email=...  (doctor searching for a patient to start a conversation with)
const lookupUserByEmail = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "email is required" });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: "No patient found with that email" });

    res.json({ userId: user.userId, name: user.name, email: user.email });
  } catch (error) {
    console.error("lookupUserByEmail error:", error);
    res.status(500).json({ message: "Failed to look up patient" });
  }
};

// GET /api/patients/user/:userId
const getPatient = async (req, res) => {
  try {
    const patient = await Patient.findOne({ userId: req.params.userId }).sort({
      createdAt: -1,
    });
    if (!patient) return res.status(404).json({ message: "Patient not found" });
    res.json(patient);
  } catch (error) {
    console.error("getPatient error:", error);
    res.status(500).json({ message: "Failed to fetch patient" });
  }
};

// POST /api/users/:userId/portal-invite  (doctor only)
// Issues a short-lived signed invite the patient redeems on the auth service
// to set a portal password. The patient service owns the User record, so it
// is the one that vouches for {userId, email, name}; the auth service only
// needs to verify the signature (shared JWT_SECRET) -- services never query
// each other's data. Re-issuing an invite is harmless and doubles as a
// password-reset path.
const createPortalInvite = async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.params.userId });
    if (!user) return res.status(404).json({ message: "Patient not found" });

    const inviteToken = jwt.sign(
      { role: "patient-invite", userId: user.userId, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "72h" }
    );

    res.status(201).json({
      inviteToken,
      // The frontend shows this as a copyable link for the doctor to share.
      activatePath: `/portal/activate?token=${inviteToken}`,
      expiresInHours: 72,
    });
  } catch (error) {
    console.error("createPortalInvite error:", error);
    res.status(500).json({ message: "Failed to create portal invite" });
  }
};

module.exports = { createUser, getUser, lookupUserByEmail, registerPatient, getPatient, createPortalInvite };
