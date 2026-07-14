import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { listConversations } from "../lib/api";

// The patient's own consultation sessions. Same endpoint the doctor
// dashboard uses -- the backend scopes the list by the token's role
// (patient tokens see sessions recorded about them).
const PortalDashboard = () => {
  const navigate = useNavigate();
  const patient = JSON.parse(localStorage.getItem("patientInfo") || "null");
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listConversations()
      .then(setSessions)
      .catch(() => setError("Failed to load your sessions."));
  }, []);

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
