import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({ baseURL: API_BASE_URL });

// Attach whichever role's token is present (a browser session is only ever one role at a time)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("doctorToken") || localStorage.getItem("adminToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const createUser = async (user) => {
  const { data } = await api.post("/users", user);
  return data;
};

export const getUser = async (userId) => {
  const { data } = await api.get(`/users/${userId}`);
  return data;
};

export const getPatient = async (userId) => {
  try {
    const { data } = await api.get(`/patients/user/${userId}`);
    return data;
  } catch (error) {
    if (error.response?.status === 404) return null;
    throw error;
  }
};

export const registerPatient = async (formData) => {
  const { data } = await api.post("/patients", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const createAppointment = async (appointment) => {
  const { data } = await api.post("/appointments", appointment);
  return data;
};

export const getAppointment = async (appointmentId) => {
  const { data } = await api.get(`/appointments/${appointmentId}`);
  return data;
};

export const getRecentAppointmentList = async () => {
  const { data } = await api.get("/appointments");
  return data;
};

export const updateAppointment = async (appointmentId, payload) => {
  const { data } = await api.put(`/appointments/${appointmentId}`, payload);
  return data;
};

export const adminLogin = async (passkey) => {
  const { data } = await api.post("/auth/admin-login", { passkey });
  return data;
};

export const doctorRegister = async (payload) => {
  const { data } = await api.post("/auth/doctor/register", payload);
  return data;
};

export const doctorLogin = async (email, password) => {
  const { data } = await api.post("/auth/doctor/login", { email, password });
  return data;
};

export const lookupPatientByEmail = async (email) => {
  try {
    const { data } = await api.get("/users/lookup", { params: { email } });
    return data;
  } catch (error) {
    if (error.response?.status === 404) return null;
    throw error;
  }
};

export const listConversations = async () => {
  const { data } = await api.get("/conversations");
  return data;
};

export const startConversation = async (userId, patientName) => {
  const { data } = await api.post("/conversations", { userId, patientName });
  return data;
};

export const stopConversation = async (sessionId) => {
  const { data } = await api.put(`/conversations/${sessionId}/stop`);
  return data;
};

export default api;
