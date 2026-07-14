import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { deleteReminder, listConversations, listReminders } from "../lib/api";
import { isReminderCurrent } from "../lib/reminderSchedule";

// The patient's own consultation sessions. Same endpoint the doctor
// dashboard uses -- the backend scopes the list by the token's role
// (patient tokens see sessions recorded about them).
const PortalDashboard = () => {
  const navigate = useNavigate();
  const patient = JSON.parse(localStorage.getItem("patientInfo") || "null");
  const [sessions, setSessions] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    listConversations()
      .then(setSessions)
      .catch(() => setError("Failed to load your sessions."));
    // Reminders are best-effort: if the notification service is down the
    // portal still shows transcripts.
    listReminders().then(setReminders).catch(() => setReminders([]));
  }, []);

  const dismissReminder = async (id) => {
    try {
      await deleteReminder(id);
      setReminders((all) => all.filter((r) => r._id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const logout = () => {
    localStorage.removeItem("patientToken");
    localStorage.removeItem("patientInfo");
    navigate("/portal");
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col space-y-14 p-8">
      <header className="admin-header">
        <img src="/assets/icons/logo-full.svg" alt="logo" className="h-8 w-fit" />
        <div className="flex items-center gap-4">
          <p className="text-16-semibold">{patient?.name || "Patient"}</p>
          <button onClick={logout} className="text-14-regular text-green-500">
            Log out
          </button>
        </div>
      </header>

      <main className="space-y-6">
        <section className="space-y-4">
          <h1 className="header">Your consultations</h1>
          <p className="text-dark-700">
            Transcripts of your recorded conversations. You can read each one and download it as
            an Excel file.
          </p>
        </section>

        {reminders.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-16-semibold">Your medication reminders</h2>
            <ul className="space-y-2">
              {reminders.map((reminder) => {
                const current = isReminderCurrent(reminder);
                return (
                  <li
                    key={reminder._id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-14-regular ${
                      current ? "border-green-500" : "border-dark-500 opacity-60"
                    }`}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-green-600 px-2 py-0.5 text-12-semibold text-white">
                        {reminder.medication}
                      </span>
                      <span className="text-white">{reminder.times.join(" · ")}</span>
                      {reminder.timingLabel && (
                        <span className="text-dark-600">({reminder.timingLabel})</span>
                      )}
                      {reminder.endDate && (
                        <span className="text-dark-600">
                          until {new Date(reminder.endDate).toLocaleDateString()}
                        </span>
                      )}
                      {current && (
                        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-12-semibold text-white">
                          due today
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => dismissReminder(reminder._id)}
                      className="text-14-regular text-red-500"
                    >
                      Dismiss
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="space-y-4">
          {error && <p className="shad-error text-14-regular">{error}</p>}
          {!error && !sessions && <p className="text-dark-600 text-14-regular">Loading...</p>}
          {sessions?.length === 0 && (
            <p className="text-dark-600 text-14-regular">No recorded consultations yet.</p>
          )}
          {sessions?.length > 0 && (
            <ul className="space-y-2">
              {sessions.map((session) => (
                <li key={session._id}>
                  <Link
                    to={`/portal/sessions/${session._id}`}
                    className="flex items-center justify-between rounded-md border border-dark-500 p-3 text-14-regular hover:bg-dark-400"
                  >
                    <span>{new Date(session.startedAt).toLocaleString()}</span>
                    <span className="text-dark-600">
                      {session.transcriptStatus === "done" ? "Transcript ready" : session.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
};

export default PortalDashboard;
