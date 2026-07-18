const DoctorContact = require("../models/DoctorContact");
const MedicalDocument = require("../models/MedicalDocument");
const Visit = require("../models/Visit");
const HealthAppointment = require("../models/HealthAppointment");

// GET /api/overview -- the dashboard in one round trip: counts, the next
// few upcoming appointments, and the most recent visits.
const getOverview = async (req, res) => {
  try {
    const ownerId = req.auth.doctorId;
    const now = new Date();

    const [doctors, documents, visits, upcomingCount, upcoming, recentVisits] =
      await Promise.all([
        DoctorContact.countDocuments({ ownerId }),
        MedicalDocument.countDocuments({ ownerId }),
        Visit.countDocuments({ ownerId }),
        HealthAppointment.countDocuments({ ownerId, status: "upcoming", schedule: { $gte: now } }),
        HealthAppointment.find({ ownerId, status: "upcoming", schedule: { $gte: now } })
          .sort({ schedule: 1 })
          .limit(5)
          .populate("doctor", "name specialization hospital"),
        Visit.find({ ownerId })
          .sort({ date: -1 })
          .limit(5)
          .populate("doctor", "name specialization hospital"),
      ]);

    res.json({
      counts: { doctors, documents, visits, upcomingAppointments: upcomingCount },
      upcomingAppointments: upcoming,
      recentVisits,
    });
  } catch (error) {
    console.error("getOverview error:", error);
    res.status(500).json({ message: "Failed to load overview" });
  }
};

module.exports = { getOverview };
