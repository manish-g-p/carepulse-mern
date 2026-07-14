const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Doctor = require("../models/Doctor");
const PatientCredential = require("../models/PatientCredential");

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

const signDoctorToken = (doctor) =>
  jwt.sign(
    { role: "doctor", doctorId: doctor._id.toString(), name: doctor.name },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

// POST /api/auth/doctor/register  { name, email, password, specialization }
const doctorRegister = async (req, res) => {
  try {
    const { name, email, password, specialization } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const existing = await Doctor.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const doctor = await Doctor.create({ name, email, passwordHash, specialization });

    res.status(201).json({
      token: signDoctorToken(doctor),
      doctor: { id: doctor._id, name: doctor.name, email: doctor.email, specialization: doctor.specialization },
    });
  } catch (error) {
    console.error("doctorRegister error:", error);
    res.status(500).json({ message: "Failed to register doctor" });
  }
};

// POST /api/auth/doctor/login  { email, password }
const doctorLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const doctor = await Doctor.findOne({ email: email.toLowerCase().trim() });
    const valid = doctor && (await doctor.comparePassword(password));
    if (!valid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({
      token: signDoctorToken(doctor),
      doctor: { id: doctor._id, name: doctor.name, email: doctor.email, specialization: doctor.specialization },
    });
  } catch (error) {
    console.error("doctorLogin error:", error);
    res.status(500).json({ message: "Failed to log in" });
  }
};

const signPatientToken = (credential) =>
  jwt.sign(
    { role: "patient", userId: credential.userId, name: credential.name },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

// POST /api/auth/patient/activate  { inviteToken, password }
// Redeems a doctor-issued portal invite (signed by the patient service, which
// owns the User record) and sets the patient's password. Upsert by userId, so
// re-inviting a patient doubles as a password reset. The invite's signature is
// the only trust needed -- no cross-service lookup.
const patientActivate = async (req, res) => {
  try {
    const { inviteToken, password } = req.body;
    if (!inviteToken || !password) {
      return res.status(400).json({ message: "inviteToken and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    let invite;
    try {
      invite = jwt.verify(inviteToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ message: "This invite link is invalid or has expired" });
    }
    if (invite.role !== "patient-invite") {
      return res.status(401).json({ message: "This invite link is invalid or has expired" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const credential = await PatientCredential.findOneAndUpdate(
      { userId: invite.userId },
      { userId: invite.userId, name: invite.name, email: invite.email, passwordHash },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({
      token: signPatientToken(credential),
      patient: { userId: credential.userId, name: credential.name, email: credential.email },
    });
  } catch (error) {
    console.error("patientActivate error:", error);
    res.status(500).json({ message: "Failed to activate portal account" });
  }
};

// POST /api/auth/patient/login  { email, password }
const patientLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const credential = await PatientCredential.findOne({ email: email.toLowerCase().trim() });
    const valid = credential && (await credential.comparePassword(password));
    if (!valid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({
      token: signPatientToken(credential),
      patient: { userId: credential.userId, name: credential.name, email: credential.email },
    });
  } catch (error) {
    console.error("patientLogin error:", error);
    res.status(500).json({ message: "Failed to log in" });
  }
};

module.exports = { adminLogin, doctorRegister, doctorLogin, patientActivate, patientLogin };
