import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminLoginModal from "../components/AdminLoginModal";
import StatCard from "../components/StatCard";
import AppointmentsTable from "../components/table/AppointmentsTable";
import { getAdminAuditLog, getRecentAppointmentList } from "../lib/api";

// Raw audit action -> readable label (same wording as the doctor's view).
const AUDIT_ACTION_LABELS = {
  start: "Recording started",
  stop: "Recording stopped",
  "download-audio": "Audio downloaded",
  "download-excel": "Excel downloaded",
};

const Admin = () => {
  const [authenticated, setAuthenticated] = useState(!!localStorage.getItem("adminToken"));
  const [appointments, setAppointments] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [error, setError] = useState("");

  const loadAppointments = useCallback(async () => {
    try {
      const data = await getRecentAppointmentList();
      setAppointments(data);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem("adminToken");
        setAuthenticated(false);
      } else {
        setError("Failed to load appointments.");
      }
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    loadAppointments();
    // Best-effort: the audit section simply stays empty if the conversation
    // service is unreachable.
    getAdminAuditLog().then(setAuditLog).catch(() => setAuditLog([]));
  }, [authenticated, loadAppointments]);

  if (!authenticated) {
    return <AdminLoginModal onSuccess={() => setAuthenticated(true)} />;
  }

  if (!appointments) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-14-regular text-dark-600">{error || "Loading..."}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col space-y-14">
      <header className="admin-header">
        <Link to="/" className="cursor-pointer">
          <img src="/assets/icons/logo-full.svg" alt="logo" className="h-8 w-fit" />
        </Link>
        <p className="text-16-semibold">Admin Dashboard</p>
      </header>

      <main className="admin-main">
        <section className="w-full space-y-4">
          <h1 className="header">Welcome 👋</h1>
          <p className="text-dark-700">Start the day with managing new appointments</p>
        </section>

        <section className="admin-stat">
          <StatCard
            type="appointments"
            count={appointments.scheduledCount}
            label="Scheduled appointments"
            icon="/assets/icons/appointments.svg"
          />
          <StatCard
            type="pending"
            count={appointments.pendingCount}
            label="Pending appointments"
            icon="/assets/icons/pending.svg"
          />
          <StatCard
            type="cancelled"
            count={appointments.cancelledCount}
            label="Cancelled appointments"
            icon="/assets/icons/cancelled.svg"
          />
        </section>

        <AppointmentsTable data={appointments.documents} />

        <section className="w-full space-y-4">
          <h2 className="text-16-semibold">Recording audit log</h2>
          <p className="text-dark-700 text-14-regular">
            Who recorded or downloaded what, across all doctors (most recent first).
          </p>
          {auditLog.length === 0 ? (
            <p className="text-dark-600 text-14-regular">No audit entries.</p>
          ) : (
            <ul className="space-y-1">
              {auditLog.map((entry) => (
                <li
                  key={entry._id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dark-500 p-2 text-14-regular"
                >
                  <span className="text-white">
                    {AUDIT_ACTION_LABELS[entry.action] || entry.action}
                    {entry.actor === "patient" && (
                      <span className="text-dark-600"> (by patient via portal)</span>
                    )}
                  </span>
                  <span className="text-dark-600">{entry.patientName}</span>
                  <span className="text-dark-600" title={`doctor ${entry.doctorId}`}>
                    dr…{String(entry.doctorId).slice(-6)}
                  </span>
                  <span className="text-dark-600">{new Date(entry.at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
};

export default Admin;
