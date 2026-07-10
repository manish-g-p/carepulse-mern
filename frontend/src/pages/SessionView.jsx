import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import Button from "../components/ui/Button";
import SessionTranscript from "../components/SessionTranscript";
import { deleteConversation, getConversation } from "../lib/api";

const SessionView = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

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
