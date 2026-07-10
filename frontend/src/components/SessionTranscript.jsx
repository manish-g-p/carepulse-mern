import { useEffect, useState } from "react";

import Button from "./ui/Button";
import {
  downloadConversationExcel,
  getConversationAudioUrl,
  getConversationAudit,
  getTranslationLanguages,
  translateConversation,
  updateSpeakerRoles,
} from "../lib/api";

const ROLE_OPTIONS = ["", "Doctor", "Patient", "Patient Party 1", "Patient Party 2"];

// Raw audit action -> readable label for the activity log.
const ACTION_LABELS = {
  start: "Recording started",
  stop: "Recording stopped",
  "download-audio": "Audio downloaded",
  "download-excel": "Excel downloaded",
};

// Full detail view for one conversation session: playback, transcript with
// per-speaker role relabeling, translation, and Excel export. Used both
// inline in the Conversation page's "Past sessions" list and on the
// dashboard's session detail view (Day 9), so it manages its own audio-blob
// state rather than relying on a parent-held map keyed by session id.
const SessionTranscript = ({ session, onUpdate }) => {
  const [audioUrl, setAudioUrl] = useState(null);
  const [languages, setLanguages] = useState([]);
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState("");
  const [auditLog, setAuditLog] = useState(null); // null = not loaded yet

  // Empty list simply hides the translate controls -- the endpoint returns []
  // when the local translation server isn't running.
  useEffect(() => {
    getTranslationLanguages().then(setLanguages).catch(() => setLanguages([]));
  }, []);

  const playRecording = async () => {
    if (audioUrl) return;
    try {
      const url = await getConversationAudioUrl(session._id);
      setAudioUrl(url);
    } catch (error) {
      console.error(error);
    }
  };

  const relabelSpeaker = async (speaker, role) => {
    const nextRoles = { ...(session.speakerRoles || {}), [speaker]: role };
    try {
      await updateSpeakerRoles(session._id, nextRoles);
      onUpdate?.();
    } catch (error) {
      console.error(error);
    }
  };

  const downloadExcel = async () => {
    try {
      await downloadConversationExcel(session._id, session.patientName);
    } catch (error) {
      console.error(error);
    }
  };

  const toggleAuditLog = async () => {
    if (auditLog !== null) {
      setAuditLog(null); // collapse
      return;
    }
    try {
      setAuditLog(await getConversationAudit(session._id));
    } catch (error) {
      console.error(error);
      setAuditLog([]);
    }
  };

  const translate = async () => {
    if (!sourceLang || !targetLang) return;
    setIsTranslating(true);
    setTranslateError("");
    try {
      await translateConversation(session._id, sourceLang, targetLang);
      onUpdate?.();
    } catch (error) {
      setTranslateError(error.response?.data?.message || "Translation failed.");
    }
    setIsTranslating(false);
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dark-500 p-3 text-14-regular">
      <div className="flex justify-between">
        <span>{session.patientName}</span>
        <span className="text-dark-600">{session.status}</span>
        <span className="text-dark-600">{new Date(session.startedAt).toLocaleString()}</span>
      </div>
      {session.audioObjectKey &&
        (audioUrl ? (
          <audio controls src={audioUrl} className="w-full" />
        ) : (
          <Button variant="outline" onClick={playRecording} className="w-fit text-14-regular">
            ▶ Play recording
          </Button>
        ))}

      {session.transcriptStatus === "processing" && (
        <p className="text-dark-600 italic">Transcribing...</p>
      )}
      {session.transcriptStatus === "failed" && <p className="shad-error">Transcription failed.</p>}
      {session.transcriptStatus === "done" &&
        (session.segments?.length ? (
          <div className="space-y-3 rounded-md bg-dark-400 p-2">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={downloadExcel} className="w-fit text-14-regular">
                ⬇ Download Excel
              </Button>
              {languages.length > 0 && (
                <>
                  <select
                    value={sourceLang}
                    onChange={(e) => setSourceLang(e.target.value)}
                    className="rounded-md border border-dark-500 bg-dark-300 px-2 py-1 text-white"
                  >
                    {languages.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        from {lang.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                    className="rounded-md border border-dark-500 bg-dark-300 px-2 py-1 text-white"
                  >
                    <option value="">to...</option>
                    {languages
                      .filter((lang) => lang.code !== sourceLang)
                      .map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          to {lang.name}
                        </option>
                      ))}
                  </select>
                  <Button
                    variant="outline"
                    onClick={translate}
                    disabled={isTranslating || !targetLang}
                    className="w-fit text-14-regular"
                  >
                    {isTranslating ? "Translating..." : "🌐 Translate"}
                  </Button>
                </>
              )}
            </div>
            {translateError && <p className="shad-error">{translateError}</p>}

            {session.keyItems &&
              (session.keyItems.medications.length ||
                session.keyItems.timings.length ||
                session.keyItems.symptoms.length) > 0 && (
                <div className="space-y-2 rounded-md border border-dark-500 p-2">
                  <p className="text-14-medium text-white">Key items</p>
                  {[
                    ["💊 Medications", session.keyItems.medications, "bg-green-600"],
                    ["⏰ Dosage & timing", session.keyItems.timings, "bg-blue-600"],
                    ["🩺 Symptoms", session.keyItems.symptoms, "bg-red-600"],
                  ].map(([label, items, color]) =>
                    items.length ? (
                      <div key={label} className="flex flex-wrap items-center gap-2">
                        <span className="text-dark-600">{label}:</span>
                        {items.map((item) => (
                          <span
                            key={item}
                            className={`rounded-full px-2 py-0.5 text-12-semibold text-white ${color}`}
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : null
                  )}
                </div>
              )}

            <div className="flex flex-wrap gap-3">
              {[...new Set(session.segments.map((s) => s.speaker))].map((speaker) => (
                <label key={speaker} className="flex items-center gap-2 text-dark-600">
                  {speaker}
                  <select
                    value={session.speakerRoles?.[speaker] || ""}
                    onChange={(e) => relabelSpeaker(speaker, e.target.value)}
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
            <div className="space-y-2">
              {session.segments.map((seg, i) => (
                <div key={i}>
                  <p className="text-white">
                    <span className="font-semibold text-green-500">
                      {session.speakerRoles?.[seg.speaker] || seg.speaker}:{" "}
                    </span>
                    {seg.text}
                  </p>
                  {seg.translatedText && (
                    <p className="pl-4 text-dark-600 italic">{seg.translatedText}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="rounded-md bg-dark-400 p-2 text-white">
            {session.transcript || "(no speech detected)"}
          </p>
        ))}

      <div>
        <button onClick={toggleAuditLog} className="text-14-regular text-green-500">
          {auditLog !== null ? "Hide activity log" : "Show activity log"}
        </button>
        {auditLog !== null && (
          <ul className="mt-2 space-y-1 rounded-md border border-dark-500 p-2 text-14-regular">
            {auditLog.length === 0 ? (
              <li className="text-dark-600">No activity recorded.</li>
            ) : (
              auditLog.map((entry) => (
                <li key={entry._id} className="flex justify-between text-dark-600">
                  <span className="text-white">{ACTION_LABELS[entry.action] || entry.action}</span>
                  <span>{new Date(entry.at).toLocaleString()}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
};

export default SessionTranscript;
