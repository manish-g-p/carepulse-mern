import { useNavigate } from "react-router-dom";

const DoctorDashboard = () => {
  const navigate = useNavigate();
  const doctor = JSON.parse(localStorage.getItem("doctorInfo") || "null");

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

      <main className="space-y-4">
        <h1 className="header">Welcome back 👋</h1>
        <p className="text-dark-700">
          Conversation recording, transcription, and translation tools land here next.
        </p>
      </main>
    </div>
  );
};

export default DoctorDashboard;
