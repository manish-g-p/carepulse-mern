const DoctorContact = require("../models/DoctorContact");

// Personal doctor directory (Health Records module). Every query is scoped
// to the signed-in account via ownerId, so one user can never see or touch
// another's directory.

const ownerId = (req) => req.auth.doctorId;

// GET /api/doctors?q=&specialization=
// q matches name/hospital/email/specialization (case-insensitive substring);
// specialization narrows to an exact specialization value.
const listDoctors = async (req, res) => {
  try {
    const filter = { ownerId: ownerId(req) };
    const { q, specialization } = req.query;
    if (specialization) filter.specialization = specialization;
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: rx }, { hospital: rx }, { email: rx }, { specialization: rx }];
    }
    const doctors = await DoctorContact.find(filter).sort({ name: 1 });
    res.json(doctors);
  } catch (error) {
    console.error("listDoctors error:", error);
    res.status(500).json({ message: "Failed to load doctors" });
  }
};

// POST /api/doctors  { name, specialization, phone, email, hospital, address, notes }
const createDoctor = async (req, res) => {
  try {
    const { name, specialization, phone, email, hospital, address, notes } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Doctor name is required" });
    }
    const doctor = await DoctorContact.create({
      ownerId: ownerId(req),
      name,
      specialization,
      phone,
      email,
      hospital,
      address,
      notes,
    });
    res.status(201).json(doctor);
  } catch (error) {
    console.error("createDoctor error:", error);
    res.status(500).json({ message: "Failed to add doctor" });
  }
};

// PUT /api/doctors/:id
const updateDoctor = async (req, res) => {
  try {
    const allowed = ["name", "specialization", "phone", "email", "hospital", "address", "notes"];
    const updates = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }
    if ("name" in updates && !String(updates.name || "").trim()) {
      return res.status(400).json({ message: "Doctor name is required" });
    }
    const doctor = await DoctorContact.findOneAndUpdate(
      { _id: req.params.id, ownerId: ownerId(req) },
      updates,
      { new: true, runValidators: true }
    );
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });
    res.json(doctor);
  } catch (error) {
    console.error("updateDoctor error:", error);
    res.status(500).json({ message: "Failed to update doctor" });
  }
};

// DELETE /api/doctors/:id
const deleteDoctor = async (req, res) => {
  try {
    const doctor = await DoctorContact.findOneAndDelete({
      _id: req.params.id,
      ownerId: ownerId(req),
    });
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });
    res.json({ message: "Doctor removed" });
  } catch (error) {
    console.error("deleteDoctor error:", error);
    res.status(500).json({ message: "Failed to delete doctor" });
  }
};

module.exports = { listDoctors, createDoctor, updateDoctor, deleteDoctor };
