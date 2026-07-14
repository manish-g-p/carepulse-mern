import { Navigate } from "react-router-dom";

// Gates patient-portal pages. Redirects to portal login when there's no
// patient session.
const RequirePatient = ({ children }) => {
  const token = localStorage.getItem("patientToken");
  if (!token) {
    return <Navigate to="/portal" replace />;
  }
  return children;
};

export default RequirePatient;
