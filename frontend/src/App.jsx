import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Register from "./pages/Register.jsx";
import NewAppointment from "./pages/NewAppointment.jsx";
import Success from "./pages/Success.jsx";
import Admin from "./pages/Admin.jsx";
import DoctorRegister from "./pages/DoctorRegister.jsx";
import DoctorLogin from "./pages/DoctorLogin.jsx";
import DoctorDashboard from "./pages/DoctorDashboard.jsx";
import Conversation from "./pages/Conversation.jsx";
import SessionView from "./pages/SessionView.jsx";
import PortalLogin from "./pages/PortalLogin.jsx";
import PortalActivate from "./pages/PortalActivate.jsx";
import PortalDashboard from "./pages/PortalDashboard.jsx";
import PortalSessionView from "./pages/PortalSessionView.jsx";
import Overview from "./pages/Overview.jsx";
import MyDoctors from "./pages/MyDoctors.jsx";
import Documents from "./pages/Documents.jsx";
import Visits from "./pages/Visits.jsx";
import HealthAppointments from "./pages/HealthAppointments.jsx";
import Pharmacy from "./pages/Pharmacy.jsx";
import Profile from "./pages/Profile.jsx";
import RequireDoctor from "./components/RequireDoctor.jsx";
import RequirePatient from "./components/RequirePatient.jsx";

// Health Records module pages, all doctor-authenticated.
const recordsRoutes = [
  ["/doctor/overview", <Overview />],
  ["/doctor/doctors", <MyDoctors />],
  ["/doctor/documents", <Documents />],
  ["/doctor/visits", <Visits />],
  ["/doctor/appointments", <HealthAppointments />],
  ["/doctor/pharmacy", <Pharmacy />],
  ["/doctor/profile", <Profile />],
];

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/patients/:userId/register" element={<Register />} />
      <Route path="/patients/:userId/new-appointment" element={<NewAppointment />} />
      <Route path="/patients/:userId/new-appointment/success" element={<Success />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/doctor/register" element={<DoctorRegister />} />
      <Route path="/doctor/login" element={<DoctorLogin />} />
      <Route
        path="/doctor/dashboard"
        element={
          <RequireDoctor>
            <DoctorDashboard />
          </RequireDoctor>
        }
      />
      <Route
        path="/doctor/conversation"
        element={
          <RequireDoctor>
            <Conversation />
          </RequireDoctor>
        }
      />
      <Route
        path="/doctor/sessions/:sessionId"
        element={
          <RequireDoctor>
            <SessionView />
          </RequireDoctor>
        }
      />
      {recordsRoutes.map(([path, element]) => (
        <Route key={path} path={path} element={<RequireDoctor>{element}</RequireDoctor>} />
      ))}
      <Route path="/portal" element={<PortalLogin />} />
      <Route path="/portal/activate" element={<PortalActivate />} />
      <Route
        path="/portal/dashboard"
        element={
          <RequirePatient>
            <PortalDashboard />
          </RequirePatient>
        }
      />
      <Route
        path="/portal/sessions/:sessionId"
        element={
          <RequirePatient>
            <PortalSessionView />
          </RequirePatient>
        }
      />
    </Routes>
  );
}

export default App;
