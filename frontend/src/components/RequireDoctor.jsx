import { Navigate } from "react-router-dom";

// Gates doctor-only pages. Redirects to login when there's no doctor session.
const RequireDoctor = ({ children }) => {
  const token = localStorage.getItem("doctorToken");
  if (!token) {
    return <Navigate to="/doctor/login" replace />;
  }
  return children;
};

export default RequireDoctor;
