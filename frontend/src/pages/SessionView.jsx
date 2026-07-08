import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import SessionTranscript from "../components/SessionTranscript";
import { getConversation } from "../lib/api";

const SessionView = () => {
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");

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
        {session && <SessionTranscript session={session} onUpdate={load} />}
      </main>
    </div>
  );
};

export default SessionView;
