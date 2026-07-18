import axios from "axios";

// The nginx gateway (:8080) is the single API entry point since the Phase 5
// split -- it routes /api/auth, /api/conversations, and the rest to the
// per-domain services. Start it with `docker compose up -d` at the repo root.
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

const api = axios.create({ baseURL: API_BASE_URL });

// Attach whichever role's token is present (a browser session is only ever
// one role at a time -- portal login/activation clears doctor/admin tokens
// and vice versa, so precedence here never actually decides anything).
api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("doctorToken") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("patientToken");
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

// Doctor-issued portal invite for a patient (Day 24). Returns
// { inviteToken, activatePath, expiresInHours }.
export const createPortalInvite = async (userId) => {
  const { data } = await api.post(`/users/${userId}/portal-invite`);
  return data;
};

export const patientActivate = async (inviteToken, password) => {
  const { data } = await api.post("/auth/patient/activate", { inviteToken, password });
  return data;
};

export const patientLogin = async (email, password) => {
  const { data } = await api.post("/auth/patient/login", { email, password });
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

export const getConversation = async (sessionId) => {
  const { data } = await api.get(`/conversations/${sessionId}`);
  return data;
};

export const deleteConversation = async (sessionId) => {
  const { data } = await api.delete(`/conversations/${sessionId}`);
  return data;
};

export const startConversation = async (userId, patientName, consentGiven, numSpeakers) => {
  const { data } = await api.post("/conversations", {
    userId,
    patientName,
    consentGiven,
    numSpeakers,
  });
  return data;
};

export const stopConversation = async (sessionId, audioBlob) => {
  const formData = new FormData();
  if (audioBlob) {
    formData.append("audio", audioBlob, "recording.webm");
  }
  const { data } = await api.put(`/conversations/${sessionId}/stop`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

// Posts the audio-recorded-so-far for a quick transcription pass; returns
// { transcript, translatedTranscript } (transient -- nothing stored
// server-side). Pass source+target language codes to also get the live
// transcript translated.
export const transcribeLiveChunk = async (sessionId, audioBlob, source, target) => {
  const formData = new FormData();
  formData.append("audio", audioBlob, "live.webm");
  if (source && target) {
    formData.append("source", source);
    formData.append("target", target);
  }
  const { data } = await api.post(`/conversations/${sessionId}/live`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

// Medication reminders (notification-service, Day 26).
export const createReminder = async (reminder) => {
  const { data } = await api.post("/reminders", reminder);
  return data;
};

export const listReminders = async () => {
  const { data } = await api.get("/reminders");
  return data;
};

export const deleteReminder = async (reminderId) => {
  const { data } = await api.delete(`/reminders/${reminderId}`);
  return data;
};

// ws(s):// URL of the live-transcript WebSocket, derived from the API base so
// it goes through the same gateway.
export const getLiveSocketUrl = () => {
  // Absolute API base (e.g. http://localhost:8080/api): just swap the scheme.
  if (/^https?:\/\//.test(API_BASE_URL)) {
    return `${API_BASE_URL.replace(/^http/, "ws")}/conversations/live`;
  }
  // Relative base (e.g. "/api", used for same-origin hosting / a tunnel):
  // build an absolute ws(s):// URL from the current page origin, so it works
  // over HTTPS tunnels (wss) too. WebSocket() requires an absolute URL.
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}${API_BASE_URL}/conversations/live`;
};

// Asks the API for a short-lived signed download URL (Day 28) and returns it
// as an absolute URL through the gateway -- usable directly as an <audio>
// src or <a href> with no auth header.
export const getSignedDownloadUrl = async (sessionId, kind) => {
  const { data } = await api.post(`/conversations/${sessionId}/download-url`, { kind });
  return `${API_BASE_URL.replace(/\/api$/, "")}${data.url}`;
};

// Recorded-audio playback source: a signed URL the <audio> element can
// stream from directly (previously this fetched the whole blob with the
// auth header and built an object URL).
export const getConversationAudioUrl = (sessionId) => getSignedDownloadUrl(sessionId, "audio");

export const updateSpeakerRoles = async (sessionId, speakerRoles) => {
  const { data } = await api.put(`/conversations/${sessionId}/speaker-roles`, { speakerRoles });
  return data;
};

export const getConversationAudit = async (sessionId) => {
  const { data } = await api.get(`/conversations/${sessionId}/audit`);
  return data;
};

// Admin-only: recent audit entries across all doctors (Day 30).
export const getAdminAuditLog = async () => {
  const { data } = await api.get("/conversations/audit");
  return data;
};

export const getTranslationLanguages = async () => {
  const { data } = await api.get("/conversations/languages");
  return data;
};

export const translateConversation = async (sessionId, source, target) => {
  const { data } = await api.post(`/conversations/${sessionId}/translate`, { source, target });
  return data;
};

// Fetches the transcript .xlsx and triggers a browser download (a plain
// <a href> can't carry the auth header, so this fetches as a blob first).
export const downloadConversationExcel = async (sessionId, patientName) => {
  const { data } = await api.get(`/conversations/${sessionId}/excel`, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${patientName.replace(/[^\w-]/g, "_")}-transcript.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

// ---------- Health Records module ----------

// Profile management.
export const getMyProfile = async () => {
  const { data } = await api.get("/auth/doctor/me");
  return data;
};

export const updateMyProfile = async (payload) => {
  const { data } = await api.put("/auth/doctor/me", payload);
  return data;
};

// Personal doctor directory.
export const listMyDoctors = async (params = {}) => {
  const { data } = await api.get("/doctors", { params });
  return data;
};

export const addMyDoctor = async (doctor) => {
  const { data } = await api.post("/doctors", doctor);
  return data;
};

export const updateMyDoctor = async (id, doctor) => {
  const { data } = await api.put(`/doctors/${id}`, doctor);
  return data;
};

export const deleteMyDoctor = async (id) => {
  const { data } = await api.delete(`/doctors/${id}`);
  return data;
};

// Medical documents.
export const listDocuments = async (category) => {
  const { data } = await api.get("/documents", { params: category ? { category } : {} });
  return data;
};

export const uploadDocument = async (file, title, category) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", title);
  formData.append("category", category);
  const { data } = await api.post("/documents", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const deleteDocument = async (id) => {
  const { data } = await api.delete(`/documents/${id}`);
  return data;
};

// Locally-stored documents have a root-relative /uploads URL that must go
// through the API host; Cloudinary URLs are already absolute.
export const getDocumentUrl = (doc) =>
  doc.url.startsWith("http") ? doc.url : `${API_BASE_URL.replace(/\/api$/, "")}${doc.url}`;

// Medical visits.
export const listVisits = async () => {
  const { data } = await api.get("/visits");
  return data;
};

export const createVisit = async (visit) => {
  const { data } = await api.post("/visits", visit);
  return data;
};

export const updateVisit = async (id, visit) => {
  const { data } = await api.put(`/visits/${id}`, visit);
  return data;
};

export const deleteVisit = async (id) => {
  const { data } = await api.delete(`/visits/${id}`);
  return data;
};

// Scheduled appointments (with email reminders).
export const listHealthAppointments = async (upcomingOnly = false) => {
  const { data } = await api.get("/health-appointments", {
    params: upcomingOnly ? { upcoming: 1 } : {},
  });
  return data;
};

export const createHealthAppointment = async (appointment) => {
  const { data } = await api.post("/health-appointments", appointment);
  return data;
};

export const updateHealthAppointment = async (id, payload) => {
  const { data } = await api.put(`/health-appointments/${id}`, payload);
  return data;
};

export const completeHealthAppointment = async (id) => {
  const { data } = await api.put(`/health-appointments/${id}/complete`);
  return data;
};

export const deleteHealthAppointment = async (id) => {
  const { data } = await api.delete(`/health-appointments/${id}`);
  return data;
};

export const runAppointmentReminders = async () => {
  const { data } = await api.post("/health-appointments/reminders/run");
  return data;
};

// AI pharmacy assistant.
export const getPharmacyStatus = async () => {
  const { data } = await api.get("/pharmacy/status");
  return data;
};

export const parsePrescription = async (imageFile) => {
  const formData = new FormData();
  formData.append("image", imageFile);
  const { data } = await api.post("/pharmacy/prescriptions/parse", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const searchDrugs = async (q) => {
  const { data } = await api.get("/pharmacy/drugs", { params: { q } });
  return data;
};

export const getDrugAlternatives = async (name) => {
  const { data } = await api.get("/pharmacy/drugs/alternatives", { params: { name } });
  return data;
};

// Dashboard overview.
export const getOverview = async () => {
  const { data } = await api.get("/overview");
  return data;
};

export default api;
