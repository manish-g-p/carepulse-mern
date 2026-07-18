import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { listConversations } from "../lib/api";

const DoctorDashboard = () => {
  const navigate = useNavigate();
  const doctor = JSON.parse(localStorage.getItem("doctorInfo") || "null");
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listConversations()
      .then(setSessions)
      .catch(() => setError("Failed to load past sessions."));
  }, []);

  const logout = () => {
    localStorage.removeItem("doctorToken");
    localStorage.removeItem("doctorInfo");
    navigate("/doctor/login");
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col space-y-14 p-8">
      <header className="admin-header">
        <img src="/assets/icons/logo-full.svg" alt="logo" className="h-8 w-fit" />
        <div className="flex items-center gap-4">
          <p className="text-16-semibold">{doctor?.name || "Doctor"}</p>
          <button onClick={logout} className="text-14-regular text-green-500">
            Log out
          </button>
        </div>
      </header>

      <main className="space-y-6">
        <section className="space-y-4">
          <h1 className="header">Welcome back 👋</h1>
          <p className="text-dark-700">Start a new patient conversation, or review past ones.</p>
          <div className="flex flex-wrap gap-2">
            <Link to="/doctor/conversation" className="shad-primary-btn inline-block rounded-md px-4 py-2">
              New conversation
            </Link>
            <Link to="/doctor/overview" className="shad-gray-btn inline-block rounded-md px-4 py-2">
              Health records
            </Link>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-16-semibold">Past sessions</h2>
          {error && <p className="shad-error text-14-regular">{error}</p>}
          {!error && !sessions && <p className="text-dark-600 text-14-regular">Loading...</p>}
          {sessions?.length === 0 && (
            <p className="text-dark-600 text-14-regular">No conversations recorded yet.</p>
          )}
          {sessions?.length > 0 && (
            <ul className="space-y-2">
              {sessions.map((session) => (
                <li key={session._id}>
                  <Link
                    to={`/doctor/sessions/${session._id}`}
                    className="flex items-center justify-between rounded-md border border-dark-500 p-3 text-14-regular hover:bg-dark-400"
                  >
                    <span>{session.patientName}</span>
                    <span className="text-dark-600">{session.status}</span>
                    <span className="text-dark-600">{new Date(session.startedAt).toLocaleString()}</span>
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

export default DoctorDashboard;
