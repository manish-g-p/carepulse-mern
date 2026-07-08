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
import RequireDoctor from "./components/RequireDoctor.jsx";

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
    </Routes>
  );
}

export default App;
