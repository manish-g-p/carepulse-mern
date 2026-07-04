import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Register from "./pages/Register.jsx";
import NewAppointment from "./pages/NewAppointment.jsx";
import Success from "./pages/Success.jsx";
import Admin from "./pages/Admin.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/patients/:userId/register" element={<Register />} />
      <Route path="/patients/:userId/new-appointment" element={<NewAppointment />} />
      <Route path="/patients/:userId/new-appointment/success" element={<Success />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}

export default App;
