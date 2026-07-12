import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import SessionTranscript from "../components/SessionTranscript";
import {
  getTranslationLanguages,
  listConversations,
  lookupPatientByEmail,
  startConversation,
  stopConversation,
  transcribeLiveChunk,
} from "../lib/api";

// How often (ms) the accumulating recording is sent for a live-transcript
// pass while recording. The server transcribes incrementally (only new audio
// since its committed offset), but each pass still costs a few seconds of
// whisper (+ translation when enabled) on CPU, so keep this coarse.
const LIVE_TRANSCRIBE_INTERVAL_MS = 5000;

const Conversation = () => {
  const [email, setEmail] = useState("");
  const [patient, setPatient] = useState(null);
  const [lookupError, setLookupError] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [numSpeakers, setNumSpeakers] = useState(2);

  const [activeSession, setActiveSession] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [micError, setMicError] = useState("");

  const [sessions, setSessions] = useState([]);

  const [liveTranscript, setLiveTranscript] = useState("");
  const [liveTranslated, setLiveTranslated] = useState("");
  const [languages, setLanguages] = useState([]);
  const [liveSource, setLiveSource] = useState("en");
  const [liveTarget, setLiveTarget] = useState("");

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const liveIntervalRef = useRef(null);
  const livePendingRef = useRef(false);
  // Refs mirror the pickers so the already-running live loop sees changes
  // made mid-recording (the interval closure would otherwise hold stale state).
  const liveSourceRef = useRef("en");
  const liveTargetRef = useRef("");

  // Empty list hides the live-translation pickers -- the endpoint returns []
  // when the local translation server isn't running.
  useEffect(() => {
    getTranslationLanguages().then(setLanguages).catch(() => setLanguages([]));
  }, []);

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

  const stopLiveLoop = () => {
    if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    liveIntervalRef.current = null;
    livePendingRef.current = false;
  };

  // Periodically sends the audio-so-far for a quick transcription pass so the
  // transcript fills in while the doctor is still recording. Skips a tick if
  // the previous pass hasn't come back yet (whisper on CPU can be slower than
  // the interval), and never lets a failed pass interrupt the recording.
  const startLiveLoop = (sessionId) => {
    liveIntervalRef.current = setInterval(async () => {
      if (livePendingRef.current || chunksRef.current.length === 0) return;
      livePendingRef.current = true;
      try {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const data = await transcribeLiveChunk(
          sessionId,
          blob,
          liveTargetRef.current ? liveSourceRef.current : "",
          liveTargetRef.current
        );
        setLiveTranscript(data.transcript);
        setLiveTranslated(data.translatedTranscript || "");
      } catch (error) {
        console.error("live transcription pass failed:", error);
      }
      livePendingRef.current = false;
    }, LIVE_TRANSCRIBE_INTERVAL_MS);
  };

  useEffect(() => stopLiveLoop, []); // clear the loop if the page unmounts mid-recording

  const findPatient = async () => {
    setIsLookingUp(true);
    setLookupError("");
    setPatient(null);
    setConsentGiven(false);
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
    if (!patient || !consentGiven) return;
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

      const session = await startConversation(patient.userId, patient.name, consentGiven, numSpeakers);
      setActiveSession(session);
      setLiveTranscript("");
      setLiveTranslated("");
      // 1s timeslice so chunks accumulate during recording -- without it,
      // ondataavailable only fires at stop and there'd be nothing to send
      // for the live transcript passes.
      recorder.start(1000);
      startLiveLoop(session._id);
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
    stopLiveLoop();
    try {
      const audioBlob = await stopRecorderAndGetBlob();
      stopMicTracks();
      await stopConversation(activeSession._id, audioBlob);
      setActiveSession(null);
      setPatient(null);
      setEmail("");
      setConsentGiven(false);
      setLiveTranscript("");
      setLiveTranslated("");
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
                <label className="flex items-center gap-2 text-14-regular text-dark-600">
                  People in the room
                  <select
                    value={numSpeakers}
                    onChange={(e) => setNumSpeakers(Number(e.target.value))}
                    className="rounded-md border border-dark-500 bg-dark-300 px-2 py-1 text-white"
                  >
                    <option value={2}>2 (doctor + patient)</option>
                    <option value={3}>3 (+ 1 patient party)</option>
                    <option value={4}>4 (+ 2 patient party)</option>
                  </select>
                </label>
                <label className="flex items-start gap-2 text-14-regular text-dark-600">
                  <input
                    type="checkbox"
                    checked={consentGiven}
                    onChange={(e) => setConsentGiven(e.target.checked)}
                    className="mt-1"
                  />
                  The patient has verbally consented to this conversation being recorded.
                </label>
                <Button
                  onClick={handleStart}
                  disabled={isBusy || !consentGiven}
                  className="shad-primary-btn w-full"
                >
                  {isBusy ? "Starting..." : "Start recording"}
                </Button>
              </div>
            )}
            {micError && <p className="shad-error text-14-regular">{micError}</p>}
            {actionError && <p className="shad-error text-14-regular">{actionError}</p>}
          </section>
        )}

        {activeSession && (
          <section className="max-w-2xl space-y-4 rounded-md border border-dark-500 p-4">
            <p className="text-14-medium">
              🔴 Recording with {activeSession.patientName} — started{" "}
              {new Date(activeSession.startedAt).toLocaleTimeString()}
            </p>
            {languages.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-14-regular text-dark-600">
                Live translation:
                <select
                  value={liveSource}
                  onChange={(e) => {
                    setLiveSource(e.target.value);
                    liveSourceRef.current = e.target.value;
                  }}
                  className="rounded-md border border-dark-500 bg-dark-300 px-2 py-1 text-white"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      from {lang.name}
                    </option>
                  ))}
                </select>
                <select
                  value={liveTarget}
                  onChange={(e) => {
                    setLiveTarget(e.target.value);
                    liveTargetRef.current = e.target.value;
                  }}
                  className="rounded-md border border-dark-500 bg-dark-300 px-2 py-1 text-white"
                >
                  <option value="">off</option>
                  {languages
                    .filter((lang) => lang.code !== liveSource)
                    .map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        to {lang.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div className="min-h-[80px] rounded-md bg-dark-400 p-3 text-14-regular">
              {liveTranscript ? (
                <>
                  <p className="text-white">{liveTranscript}</p>
                  {liveTranslated && (
                    <p className="mt-2 border-t border-dark-500 pt-2 text-green-500 italic">
                      {liveTranslated}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-dark-600 italic">Listening… the transcript appears here as you speak.</p>
              )}
            </div>
            <p className="text-dark-600 text-12-regular">
              Live view updates every few seconds. Speaker labels and the final transcript are
              produced when you stop.
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
                <li key={session._id}>
                  <SessionTranscript session={session} onUpdate={loadSessions} />
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
