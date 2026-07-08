import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import {
  getConversationAudioUrl,
  listConversations,
  lookupPatientByEmail,
  startConversation,
  stopConversation,
  updateSpeakerRoles,
} from "../lib/api";

const ROLE_OPTIONS = ["", "Doctor", "Patient", "Patient Party 1", "Patient Party 2"];

const Conversation = () => {
  const [email, setEmail] = useState("");
  const [patient, setPatient] = useState(null);
  const [lookupError, setLookupError] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);

  const [activeSession, setActiveSession] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [micError, setMicError] = useState("");

  const [sessions, setSessions] = useState([]);
  const [audioUrls, setAudioUrls] = useState({});

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

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

  // Transcription runs in the background after Stop; poll while anything is
  // still processing so the transcript appears without a manual refresh.
  useEffect(() => {
    const stillProcessing = sessions.some((s) => s.transcriptStatus === "processing");
    if (!stillProcessing) return undefined;
    const interval = setInterval(loadSessions, 3000);
    return () => clearInterval(interval);
  }, [sessions, loadSessions]);

  const stopMicTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

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
    setMicError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      mediaRecorderRef.current = recorder;

      const session = await startConversation(patient.userId, patient.name);
      setActiveSession(session);
      recorder.start();
      await loadSessions();
    } catch (error) {
      stopMicTracks();
      if (error.name === "NotAllowedError" || error.name === "NotFoundError") {
        setMicError("Microphone access was denied or unavailable. Allow mic access and try again.");
      } else {
        setActionError(error.response?.data?.message || "Failed to start the conversation.");
      }
    }
    setIsBusy(false);
  };

  const stopRecorderAndGetBlob = () =>
    new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(null);
        return;
      }
      recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: "audio/webm" }));
      recorder.stop();
    });

  const handleStop = async () => {
    if (!activeSession) return;
    setIsBusy(true);
    setActionError("");
    try {
      const audioBlob = await stopRecorderAndGetBlob();
      stopMicTracks();
      await stopConversation(activeSession._id, audioBlob);
      setActiveSession(null);
      setPatient(null);
      setEmail("");
      await loadSessions();
    } catch (error) {
      setActionError(error.response?.data?.message || "Failed to stop the conversation.");
    }
    setIsBusy(false);
  };

  const playRecording = async (sessionId) => {
    if (audioUrls[sessionId]) return;
    try {
      const url = await getConversationAudioUrl(sessionId);
      setAudioUrls((prev) => ({ ...prev, [sessionId]: url }));
    } catch (error) {
      console.error(error);
    }
  };

  const relabelSpeaker = async (session, speaker, role) => {
    const nextRoles = { ...(session.speakerRoles || {}), [speaker]: role };
    try {
      await updateSpeakerRoles(session._id, nextRoles);
      await loadSessions();
    } catch (error) {
      console.error(error);
    }
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
            {micError && <p className="shad-error text-14-regular">{micError}</p>}
            {actionError && <p className="shad-error text-14-regular">{actionError}</p>}
          </section>
        )}

        {activeSession && (
          <section className="max-w-md space-y-4 rounded-md border border-dark-500 p-4">
            <p className="text-14-medium">
              🔴 Recording with {activeSession.patientName} — started{" "}
              {new Date(activeSession.startedAt).toLocaleTimeString()}
            </p>
            <p className="text-dark-600 text-14-regular">
              Transcription starts once you stop. Live transcript, speaker diarization, and
              translation land here over the next few days.
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
                  className="flex flex-col gap-2 rounded-md border border-dark-500 p-3 text-14-regular"
                >
                  <div className="flex justify-between">
                    <span>{session.patientName}</span>
                    <span className="text-dark-600">{session.status}</span>
                    <span className="text-dark-600">{new Date(session.startedAt).toLocaleString()}</span>
                  </div>
                  {session.audioObjectKey &&
                    (audioUrls[session._id] ? (
                      <audio controls src={audioUrls[session._id]} className="w-full" />
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => playRecording(session._id)}
                        className="w-fit text-14-regular"
                      >
                        ▶ Play recording
                      </Button>
                    ))}

                  {session.transcriptStatus === "processing" && (
                    <p className="text-dark-600 italic">Transcribing...</p>
                  )}
                  {session.transcriptStatus === "failed" && (
                    <p className="shad-error">Transcription failed.</p>
                  )}
                  {session.transcriptStatus === "done" &&
                    (session.segments?.length ? (
                      <div className="space-y-3 rounded-md bg-dark-400 p-2">
                        <div className="flex flex-wrap gap-3">
                          {[...new Set(session.segments.map((s) => s.speaker))].map((speaker) => (
                            <label key={speaker} className="flex items-center gap-2 text-dark-600">
                              {speaker}
                              <select
                                value={session.speakerRoles?.[speaker] || ""}
                                onChange={(e) => relabelSpeaker(session, speaker, e.target.value)}
                                className="rounded-md border border-dark-500 bg-dark-300 px-2 py-1 text-white"
                              >
                                {ROLE_OPTIONS.map((role) => (
                                  <option key={role} value={role}>
                                    {role || "unlabeled"}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                        </div>
                        <div className="space-y-1">
                          {session.segments.map((seg, i) => (
                            <p key={i} className="text-white">
                              <span className="font-semibold text-green-500">
                                {session.speakerRoles?.[seg.speaker] || seg.speaker}:{" "}
                              </span>
                              {seg.text}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="rounded-md bg-dark-400 p-2 text-white">
                        {session.transcript || "(no speech detected)"}
                      </p>
                    ))}
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
