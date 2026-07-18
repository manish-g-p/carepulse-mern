const Visit = require("../models/Visit");
const DoctorContact = require("../models/DoctorContact");
const MedicalDocument = require("../models/MedicalDocument");

const ownerId = (req) => req.auth.doctorId;

// The doctor and every attached document must belong to the same owner as
// the visit -- otherwise a crafted request could link someone else's records.
const assertOwnedRefs = async (req, doctorId, documentIds) => {
  if (doctorId) {
    const doctor = await DoctorContact.findOne({ _id: doctorId, ownerId: ownerId(req) });
    if (!doctor) return "Doctor not found in your directory";
  }
  if (documentIds && documentIds.length) {
    const count = await MedicalDocument.countDocuments({
      _id: { $in: documentIds },
      ownerId: ownerId(req),
    });
    if (count !== documentIds.length) return "One or more attached documents were not found";
  }
  return null;
};

// GET /api/visits
const listVisits = async (req, res) => {
  try {
    const visits = await Visit.find({ ownerId: ownerId(req) })
      .sort({ date: -1 })
      .populate("doctor", "name specialization hospital")
      .populate("documents", "title category url mimeType");
    res.json(visits);
  } catch (error) {
    console.error("listVisits error:", error);
    res.status(500).json({ message: "Failed to load visits" });
  }
};

// POST /api/visits  { doctor, date, reason, diagnosis, treatmentNotes, documents }
const createVisit = async (req, res) => {
  try {
    const { doctor, date, reason, diagnosis, treatmentNotes, documents = [] } = req.body;
    if (!doctor || !date || !reason) {
      return res.status(400).json({ message: "doctor, date and reason are required" });
    }
    const refError = await assertOwnedRefs(req, doctor, documents);
    if (refError) return res.status(400).json({ message: refError });

    const visit = await Visit.create({
      ownerId: ownerId(req),
      doctor,
      date,
      reason,
      diagnosis,
      treatmentNotes,
      documents,
    });
    const populated = await visit.populate([
      { path: "doctor", select: "name specialization hospital" },
      { path: "documents", select: "title category url mimeType" },
    ]);
    res.status(201).json(populated);
  } catch (error) {
    console.error("createVisit error:", error);
    res.status(500).json({ message: "Failed to record visit" });
  }
};

// PUT /api/visits/:id
const updateVisit = async (req, res) => {
  try {
    const allowed = ["doctor", "date", "reason", "diagnosis", "treatmentNotes", "documents"];
    const updates = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }
    const refError = await assertOwnedRefs(req, updates.doctor, updates.documents);
    if (refError) return res.status(400).json({ message: refError });

    const visit = await Visit.findOneAndUpdate(
      { _id: req.params.id, ownerId: ownerId(req) },
      updates,
      { new: true, runValidators: true }
    )
      .populate("doctor", "name specialization hospital")
      .populate("documents", "title category url mimeType");
    if (!visit) return res.status(404).json({ message: "Visit not found" });
    res.json(visit);
  } catch (error) {
    console.error("updateVisit error:", error);
    res.status(500).json({ message: "Failed to update visit" });
  }
};

// DELETE /api/visits/:id (documents stay -- they're owned independently)
const deleteVisit = async (req, res) => {
  try {
    const visit = await Visit.findOneAndDelete({ _id: req.params.id, ownerId: ownerId(req) });
    if (!visit) return res.status(404).json({ message: "Visit not found" });
    res.json({ message: "Visit deleted" });
  } catch (error) {
    console.error("deleteVisit error:", error);
    res.status(500).json({ message: "Failed to delete visit" });
  }
};

module.exports = { listVisits, createVisit, updateVisit, deleteVisit };
