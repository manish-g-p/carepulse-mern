import { useState } from "react";

import Button from "./ui/Button";
import { downloadConversationExcel, getConversationAudioUrl, updateSpeakerRoles } from "../lib/api";

const ROLE_OPTIONS = ["", "Doctor", "Patient", "Patient Party 1", "Patient Party 2"];

// Full detail view for one conversation session: playback, transcript with
// per-speaker role relabeling, and Excel export. Used both inline in the
// Conversation page's "Past sessions" list and on the dashboard's session
// detail view (Day 9), so it manages its own audio-blob state rather than
// relying on a parent-held map keyed by session id.
const SessionTranscript = ({ session, onUpdate }) => {
  const [audioUrl, setAudioUrl] = useState(null);

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
            <Button variant="outline" onClick={downloadExcel} className="w-fit text-14-regular">
              ⬇ Download Excel
            </Button>
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
    </div>
  );
};

export default SessionTranscript;
