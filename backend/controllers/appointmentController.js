const Appointment = require("../models/Appointment");

// POST /api/appointments
const createAppointment = async (req, res) => {
  try {
    const { userId, patient, primaryPhysician, reason, schedule, note } = req.body;

    const appointment = await Appointment.create({
      userId,
      patient,
      primaryPhysician,
      reason,
      schedule,
      note,
      status: "pending",
    });

    const populated = await appointment.populate("patient");
    res.status(201).json(populated);
  } catch (error) {
    console.error("createAppointment error:", error);
    res.status(500).json({ message: "Failed to create appointment" });
  }
};

// GET /api/appointments  (admin) -> list + counts
const getRecentAppointmentList = async (req, res) => {
  try {
    const documents = await Appointment.find()
      .populate("patient")
      .sort({ createdAt: -1 });

    const counts = documents.reduce(
      (acc, appt) => {
        if (appt.status === "scheduled") acc.scheduledCount++;
        else if (appt.status === "pending") acc.pendingCount++;
        else if (appt.status === "cancelled") acc.cancelledCount++;
        return acc;
      },
      { scheduledCount: 0, pendingCount: 0, cancelledCount: 0 }
    );

    res.json({ totalCount: documents.length, ...counts, documents });
  } catch (error) {
    console.error("getRecentAppointmentList error:", error);
    res.status(500).json({ message: "Failed to fetch appointments" });
  }
};

// GET /api/appointments/:id
const getAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id).populate("patient");
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });
    res.json(appointment);
  } catch (error) {
    console.error("getAppointment error:", error);
    res.status(500).json({ message: "Failed to fetch appointment" });
  }
};

// PUT /api/appointments/:id  (admin) { type: 'schedule' | 'cancel', primaryPhysician, schedule, cancellationReason }
const updateAppointment = async (req, res) => {
  try {
    const { type, primaryPhysician, schedule, cancellationReason } = req.body;

    const status = type === "schedule" ? "scheduled" : type === "cancel" ? "cancelled" : "pending";

    const update = { status };
    if (primaryPhysician) update.primaryPhysician = primaryPhysician;
    if (schedule) update.schedule = schedule;
    if (cancellationReason) update.cancellationReason = cancellationReason;

    const appointment = await Appointment.findByIdAndUpdate(req.params.id, update, {
      new: true,
    }).populate("patient");

    if (!appointment) return res.status(404).json({ message: "Appointment not found" });

    res.json(appointment);
  } catch (error) {
    console.error("updateAppointment error:", error);
    res.status(500).json({ message: "Failed to update appointment" });
  }
};

module.exports = {
  createAppointment,
  getRecentAppointmentList,
  getAppointment,
  updateAppointment,
};
