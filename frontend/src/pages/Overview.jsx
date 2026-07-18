import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import RecordsNav from "../components/RecordsNav.jsx";
import { getOverview } from "../lib/api";

const Tile = ({ count, label, to }) => (
  <Link to={to} className="stat-card bg-dark-400 hover:bg-dark-500">
    <h2 className="text-32-bold text-white">{count}</h2>
    <p className="text-14-regular text-dark-700">{label}</p>
  </Link>
);

// Health Records dashboard: counts + upcoming appointments + recent visits.
const Overview = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getOverview()
      .then(setData)
      .catch(() => setError("Failed to load the overview."));
  }, []);

  return (
    <div className="mx-auto flex max-w-7xl flex-col space-y-8 p-8">
      <RecordsNav />
      <main className="space-y-8">
        <h1 className="header">Health overview</h1>
        {error && <p className="shad-error text-14-regular">{error}</p>}
        {!error && !data && <p className="text-dark-600 text-14-regular">Loading...</p>}

        {data && (
          <>
            <section className="flex flex-wrap gap-4">
              <Tile count={data.counts.doctors} label="Doctors" to="/doctor/doctors" />
              <Tile count={data.counts.documents} label="Documents" to="/doctor/documents" />
              <Tile count={data.counts.visits} label="Visits recorded" to="/doctor/visits" />
              <Tile
                count={data.counts.upcomingAppointments}
                label="Upcoming appointments"
                to="/doctor/appointments"
              />
            </section>

            <section className="space-y-3">
              <h2 className="sub-header">Upcoming appointments</h2>
              {data.upcomingAppointments.length === 0 && (
                <p className="text-dark-600 text-14-regular">Nothing scheduled.</p>
              )}
              <ul className="space-y-2">
                {data.upcomingAppointments.map((appt) => (
                  <li
                    key={appt._id}
                    className="flex items-center justify-between rounded-md border border-dark-500 p-3 text-14-regular"
                  >
                    <span>
                      {appt.doctor?.name || "Unknown doctor"}
                      {appt.doctor?.specialization ? ` — ${appt.doctor.specialization}` : ""}
                    </span>
                    <span className="text-dark-700">{appt.purpose}</span>
                    <span className="text-dark-600">{new Date(appt.schedule).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="sub-header">Recent visits</h2>
              {data.recentVisits.length === 0 && (
                <p className="text-dark-600 text-14-regular">No visits recorded yet.</p>
              )}
              <ul className="space-y-2">
                {data.recentVisits.map((visit) => (
                  <li
                    key={visit._id}
                    className="flex items-center justify-between rounded-md border border-dark-500 p-3 text-14-regular"
                  >
                    <span>{visit.doctor?.name || "Unknown doctor"}</span>
                    <span className="text-dark-700">{visit.reason}</span>
                    <span className="text-dark-600">{new Date(visit.date).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default Overview;
