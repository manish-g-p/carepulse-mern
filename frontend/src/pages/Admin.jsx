import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminLoginModal from "../components/AdminLoginModal";
import StatCard from "../components/StatCard";
import AppointmentsTable from "../components/table/AppointmentsTable";
import { getRecentAppointmentList } from "../lib/api";

const Admin = () => {
  const [authenticated, setAuthenticated] = useState(!!localStorage.getItem("adminToken"));
  const [appointments, setAppointments] = useState(null);
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
    if (authenticated) loadAppointments();
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
      </main>
    </div>
  );
};

export default Admin;
