import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { listConversations, lookupPatientByEmail, startConversation, stopConversation } from "../lib/api";

const Conversation = () => {
  const [email, setEmail] = useState("");
  const [patient, setPatient] = useState(null);
  const [lookupError, setLookupError] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);

  const [activeSession, setActiveSession] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const [sessions, setSessions] = useState([]);

  const loadSessions = useCallback(async () => {
    try {
      const data = await listConversations();
      setSessions(data);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const findPatient = async () => {
    setIsLookingUp(true);
    setLookupError("");
    setPatient(null);
    try {
      const found = await lookupPatientByEmail(email);
      if (!found) {
        setLookupError("No patient found with that email.");
      } else {
        setPatient(found);
      }
    } catch (error) {
      setLookupError(error.response?.data?.message || "Failed to look up patient.");
    }
    setIsLookingUp(false);
  };

  const handleStart = async () => {
    if (!patient) return;
    setIsBusy(true);
    setActionError("");
    try {
      const session = await startConversation(patient.userId, patient.name);
      setActiveSession(session);
      await loadSessions();
    } catch (error) {
      setActionError(error.response?.data?.message || "Failed to start the conversation.");
    }
    setIsBusy(false);
  };

  const handleStop = async () => {
    if (!activeSession) return;
    setIsBusy(true);
    setActionError("");
    try {
      await stopConversation(activeSession._id);
      setActiveSession(null);
      setPatient(null);
      setEmail("");
      await loadSessions();
    } catch (error) {
      setActionError(error.response?.data?.message || "Failed to stop the conversation.");
    }
    setIsBusy(false);
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col space-y-14 p-8">
      <header className="admin-header">
        <Link to="/doctor/dashboard">
          <img src="/assets/icons/logo-full.svg" alt="logo" className="h-8 w-fit" />
        </Link>
        <p className="text-16-semibold">New Conversation</p>
      </header>

      <main className="space-y-8">
        {!activeSession && (
          <section className="max-w-md space-y-4">
            <h1 className="header">Find the patient</h1>
            <div className="flex gap-3">
              <Input
                placeholder="patient@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="shad-input border border-dark-500 bg-dark-400"
              />
              <Button onClick={findPatient} disabled={isLookingUp || !email} className="shad-primary-btn">
                {isLookingUp ? "Searching..." : "Find"}
              </Button>
            </div>
            {lookupError && <p className="shad-error text-14-regular">{lookupError}</p>}

            {patient && (
              <div className="space-y-4 rounded-md border border-dark-500 p-4">
                <p className="text-14-medium">
                  {patient.name} <span className="text-dark-600">({patient.email})</span>
                </p>
                <Button onClick={handleStart} disabled={isBusy} className="shad-primary-btn w-full">
                  {isBusy ? "Starting..." : "Start recording"}
                </Button>
              </div>
            )}
            {actionError && <p className="shad-error text-14-regular">{actionError}</p>}
          </section>
        )}

        {activeSession && (
          <section className="max-w-md space-y-4 rounded-md border border-dark-500 p-4">
            <p className="text-14-medium">
              Recording with {activeSession.patientName} — started{" "}
              {new Date(activeSession.startedAt).toLocaleTimeString()}
            </p>
            <p className="text-dark-600 text-14-regular">
              Audio capture, live transcript, speaker diarization, and translation land here over the
              next few days.
            </p>
            <Button onClick={handleStop} disabled={isBusy} className="shad-danger-btn w-full">
              {isBusy ? "Stopping..." : "Stop recording"}
            </Button>
            {actionError && <p className="shad-error text-14-regular">{actionError}</p>}
          </section>
        )}

        <section className="space-y-4">
          <h2 className="text-16-semibold">Past sessions</h2>
          {sessions.length === 0 ? (
            <p className="text-dark-600 text-14-regular">No conversations recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {sessions.map((session) => (
                <li
                  key={session._id}
                  className="flex justify-between rounded-md border border-dark-500 p-3 text-14-regular"
                >
                  <span>{session.patientName}</span>
                  <span className="text-dark-600">{session.status}</span>
                  <span className="text-dark-600">{new Date(session.startedAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
};

export default Conversation;
