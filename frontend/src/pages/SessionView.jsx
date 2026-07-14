import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import Button from "../components/ui/Button";
import SessionTranscript from "../components/SessionTranscript";
import { createPortalInvite, deleteConversation, getConversation } from "../lib/api";

const SessionView = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getConversation(sessionId);
      setSession(data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load this session.");
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep polling while transcription is still running, same as the
  // Conversation page's "Past sessions" list.
  useEffect(() => {
    if (session?.transcriptStatus !== "processing") return undefined;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [session, load]);

  // Generates a portal invite for this session's patient and shows the
  // activation link for the doctor to share (there's no email sending -- $0
  // stack -- so sharing the link is the doctor's job).
  const handleInvite = async () => {
    setInviteError("");
    setCopied(false);
    try {
      const { activatePath } = await createPortalInvite(session.userId);
      setInviteLink(`${window.location.origin}${activatePath}`);
    } catch (err) {
      setInviteError(err.response?.data?.message || "Failed to create the invite link.");
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
    } catch {
      // Clipboard can be unavailable (http, permissions); the link is still
      // shown as text to copy manually.
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this session permanently? The recording, transcript, and audit log will be removed. This cannot be undone.")) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteConversation(sessionId);
      navigate("/doctor/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete this session.");
      setIsDeleting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col space-y-8 p-8">
      <header className="admin-header">
        <Link to="/doctor/dashboard">
          <img src="/assets/icons/logo-full.svg" alt="logo" className="h-8 w-fit" />
        </Link>
        <Link to="/doctor/dashboard" className="text-14-regular text-green-500">
          ← Back to dashboard
        </Link>
      </header>

      <main className="space-y-4">
        {error && <p className="shad-error text-14-regular">{error}</p>}
        {!error && !session && <p className="text-dark-600 text-14-regular">Loading...</p>}
        {session && (
          <>
            <SessionTranscript session={session} onUpdate={load} />

            <div className="space-y-2 rounded-md border border-dark-500 p-3">
              <p className="text-14-medium text-white">Patient portal</p>
              <p className="text-14-regular text-dark-600">
                Give {session.patientName} access to this transcript (and their other sessions)
                by sharing an activation link. Links expire after 72 hours; issuing a new one
                also resets their password.
              </p>
              <Button variant="outline" onClick={handleInvite} className="w-fit text-14-regular">
                ✉ Invite to portal
              </Button>
              {inviteError && <p className="shad-error text-14-regular">{inviteError}</p>}
              {inviteLink && (
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-dark-400 px-2 py-1 text-12-regular text-green-500">
                    {inviteLink}
                  </code>
                  <Button variant="outline" onClick={copyInvite} className="w-fit text-14-regular">
                    {copied ? "Copied ✓" : "Copy"}
                  </Button>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-fit text-14-regular text-red-500"
            >
              {isDeleting ? "Deleting..." : "🗑 Delete session"}
            </Button>
          </>
        )}
      </main>
    </div>
  );
};

export default SessionView;
