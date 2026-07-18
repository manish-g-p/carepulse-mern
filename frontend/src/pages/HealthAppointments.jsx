import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import RecordsNav from "../components/RecordsNav.jsx";
import {
  completeHealthAppointment,
  createHealthAppointment,
  deleteHealthAppointment,
  listHealthAppointments,
  listMyDoctors,
  runAppointmentReminders,
} from "../lib/api";

const inputClass =
  "shad-input w-full rounded-md border bg-dark-400 px-3 text-white placeholder:text-dark-600";

// Appointment scheduling: book with a directory doctor, opt into the daily
// 9 AM email reminder, mark completed, manual reminder trigger.
const HealthAppointments = () => {
  const [appointments, setAppointments] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [upcomingOnly, setUpcomingOnly] = useState(true);
  const [saving, setSaving] = useState(false);
  const doctorInfo = JSON.parse(localStorage.getItem("doctorInfo") || "null");
  const [form, setForm] = useState({
    doctor: "",
    schedule: "",
    purpose: "",
    notes: "",
    reminderEnabled: true,
    notifyEmail: doctorInfo?.email || "",
  });

  const load = (upcoming = upcomingOnly) => {
    listHealthAppointments(upcoming)
      .then(setAppointments)
      .catch(() => setError("Failed to load appointments."));
  };

  useEffect(() => {
    load();
    listMyDoctors().then(setDoctors).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcomingOnly]);

  const set = (key) => (event) =>
    setForm({
      ...form,
      [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value,
    });

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setInfo("");
    setSaving(true);
    try {
      await createHealthAppointment(form);
      setForm({ ...form, doctor: "", schedule: "", purpose: "", notes: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to schedule appointment.");
    } finally {
      setSaving(false);
    }
  };

  const complete = async (appt) => {
    try {
      await completeHealthAppointment(appt._id);
      load();
    } catch {
      setError("Failed to mark as completed.");
    }
  };

  const remove = async (appt) => {
    if (!window.confirm("Delete this appointment?")) return;
    try {
      await deleteHealthAppointment(appt._id);
      load();
    } catch {
      setError("Failed to delete appointment.");
    }
  };

  const triggerReminders = async () => {
    setError("");
    setInfo("");
    try {
      const result = await runAppointmentReminders();
      if (!result.emailConfigured) {
        setInfo("Reminder sweep ran, but email is not configured on the server (set SMTP_USER/SMTP_PASS).");
      } else {
        setInfo(`Reminder sweep: ${result.sent} sent, ${result.skipped} skipped (of ${result.checked} due).`);
      }
    } catch {
      setError("Reminder run failed.");
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col space-y-8 p-8">
      <RecordsNav />
      <main className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="header">Appointments</h1>
          <button onClick={triggerReminders} className="shad-gray-btn rounded-md px-4 py-2 text-14-regular">
            Send due reminders now
          </button>
        </div>
        <p className="text-dark-700 text-14-regular">
          Reminder emails go out automatically every day at 9 AM for appointments in the next 24 hours.
        </p>
        {error && <p className="shad-error text-14-regular">{error}</p>}
        {info && <p className="text-14-regular text-green-500">{info}</p>}

        <section className="space-y-3 rounded-lg border border-dark-500 p-4">
          <h2 className="text-16-semibold">Schedule an appointment</h2>
          {doctors.length === 0 ? (
            <p className="text-dark-600 text-14-regular">
              Add a doctor to your <Link to="/doctor/doctors" className="text-green-500">directory</Link> first.
            </p>
          ) : (
            <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
              <select
                className="shad-select-trigger rounded-md border bg-dark-400 px-3 text-white"
                value={form.doctor}
                onChange={set("doctor")}
                required
              >
                <option value="">Select doctor *</option>
                {doctors.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                    {d.specialization ? ` (${d.specialization})` : ""}
                  </option>
                ))}
              </select>
              <input
                type="datetime-local"
                className={inputClass}
                value={form.schedule}
                onChange={set("schedule")}
                required
              />
              <input className={inputClass} placeholder="Purpose *" value={form.purpose} onChange={set("purpose")} required />
              <input className={inputClass} placeholder="Notes" value={form.notes} onChange={set("notes")} />
              <input
                type="email"
                className={inputClass}
                placeholder="Reminder email"
                value={form.notifyEmail}
                onChange={set("notifyEmail")}
              />
              <label className="flex items-center gap-2 text-14-regular text-dark-700">
                <input type="checkbox" checked={form.reminderEnabled} onChange={set("reminderEnabled")} />
                Email me a reminder
              </label>
              <button type="submit" disabled={saving} className="shad-primary-btn rounded-md px-4 py-2 md:col-span-2 md:w-fit">
                {saving ? "Scheduling..." : "Schedule"}
              </button>
            </form>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="sub-header">{upcomingOnly ? "Upcoming" : "All appointments"}</h2>
            <button
              onClick={() => setUpcomingOnly(!upcomingOnly)}
              className="shad-gray-btn rounded-md px-3 py-1 text-12-regular"
            >
              {upcomingOnly ? "Show all" : "Show upcoming only"}
            </button>
          </div>
          {!appointments && !error && <p className="text-dark-600 text-14-regular">Loading...</p>}
          {appointments?.length === 0 && (
            <p className="text-dark-600 text-14-regular">Nothing here yet.</p>
          )}
          <ul className="space-y-2">
            {appointments?.map((appt) => (
              <li
                key={appt._id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dark-500 p-3 text-14-regular"
              >
                <div>
                  <p className="text-16-semibold">
                    {appt.doctor?.name || "Unknown doctor"}
                    <span className="text-dark-600"> · {new Date(appt.schedule).toLocaleString()}</span>
                  </p>
                  <p className="text-dark-700">{appt.purpose}</p>
                  {appt.notes && <p className="text-dark-600">{appt.notes}</p>}
                  <p className="text-dark-600">
                    {appt.status}
                    {appt.reminderEnabled &&
                      (appt.reminderSentAt
                        ? " · reminder sent"
                        : appt.status === "upcoming"
                          ? " · reminder pending"
                          : "")}
                  </p>
                </div>
                <div className="flex gap-2">
                  {appt.status === "upcoming" && (
                    <button onClick={() => complete(appt)} className="shad-primary-btn rounded-md px-3 py-1">
                      Mark completed
                    </button>
                  )}
                  <button onClick={() => remove(appt)} className="shad-danger-btn rounded-md px-3 py-1">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
};

export default HealthAppointments;
