import { NavLink, useNavigate } from "react-router-dom";

const links = [
  { to: "/doctor/overview", label: "Dashboard" },
  { to: "/doctor/doctors", label: "Doctors" },
  { to: "/doctor/documents", label: "Documents" },
  { to: "/doctor/visits", label: "Visits" },
  { to: "/doctor/appointments", label: "Appointments" },
  { to: "/doctor/pharmacy", label: "Pharmacy" },
  { to: "/doctor/profile", label: "Profile" },
];

// Shared header + tab bar for the Health Records pages.
const RecordsNav = () => {
  const navigate = useNavigate();
  const doctor = JSON.parse(localStorage.getItem("doctorInfo") || "null");

  const logout = () => {
    localStorage.removeItem("doctorToken");
    localStorage.removeItem("doctorInfo");
    navigate("/doctor/login");
  };

  return (
    <div className="space-y-6">
      <header className="admin-header">
        <img src="/assets/icons/logo-full.svg" alt="logo" className="h-8 w-fit" />
        <div className="flex items-center gap-4">
          <NavLink to="/doctor/dashboard" className="text-14-regular text-dark-700 hover:text-white">
            Sessions
          </NavLink>
          <p className="text-16-semibold">{doctor?.name || "Doctor"}</p>
          <button onClick={logout} className="text-14-regular text-green-500">
            Log out
          </button>
        </div>
      </header>
      <nav className="flex flex-wrap gap-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `rounded-md px-4 py-2 text-14-regular ${
                isActive ? "bg-green-500 text-white" : "bg-dark-400 text-dark-700 hover:text-white"
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default RecordsNav;
