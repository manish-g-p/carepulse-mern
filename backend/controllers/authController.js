const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Doctor = require("../models/Doctor");

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

module.exports = { adminLogin, doctorRegister, doctorLogin };
