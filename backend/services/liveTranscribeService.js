const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { convertToWav, wavDurationMs, transcribeSegments } = require("./transcribeService");
const { isTranslationAvailable, translateText } = require("./translateService");

const audioDir = path.join(__dirname, "..", "storage", "audio");
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

// In-memory per-session state for the incremental live transcript:
// committedMs/committedText = audio already transcribed and locked in;
// tailText = the still-revisable live edge from the last pass. Entries are
// removed on stop/delete. Held in memory only -- if the server restarts
// mid-recording the next pass just rebuilds from zero, which is consistent
// (both the offset and the text are lost together).
//
// Shared by the HTTP polling route and the WebSocket path (Day 25) -- a
// client can even switch transports mid-recording without losing progress.
const liveState = new Map();

// Keep the last few seconds uncommitted so whisper can revise the live edge
// (it often re-hears a trailing half-sentence once more audio arrives).
const LIVE_TAIL_MS = 4000;

const clearLiveState = (sessionId) => liveState.delete(String(sessionId));

// One incremental live-transcription pass over the recording-so-far.
// `buffer` is the FULL cumulative webm; the pass only decodes/transcribes
// audio past the already-committed offset, so a pass costs the same whether
// the recording is 1 or 60 minutes. Segments that end before the revisable
// tail get committed (text appended, offset advanced); the tail is returned
// but stays re-transcribable. Best-effort and transient: no diarization,
// nothing saved or encrypted, no audit entry -- the real transcript +
// diarization still happens on Stop from the full recording.
//
// Returns { transcript, translatedTranscript, committedMs }.
const runLivePass = async (sessionId, buffer, source, target) => {
  const key = String(sessionId);
  const state =
    liveState.get(key) ||
    { committedMs: 0, committedText: "", tailText: "", translatedCommitted: "", translatedTail: "", languagePair: "" };

  const result = () => ({
    transcript: `${state.committedText} ${state.tailText}`.trim(),
    translatedTranscript: state.languagePair
      ? `${state.translatedCommitted} ${state.translatedTail}`.trim()
      : "",
    committedMs: state.committedMs,
  });

  let tmpWebm;
  let wavPath;
  try {
    tmpWebm = path.join(audioDir, `live-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.webm`);
    fs.writeFileSync(tmpWebm, buffer);
    wavPath = await convertToWav(tmpWebm, state.committedMs);

    const windowMs = wavDurationMs(wavPath);
    if (windowMs < 1000) {
      // Not enough new audio to be worth a whisper pass; echo the last result.
      return result();
    }

    const { segments } = await transcribeSegments(wavPath);

    // Segment timestamps are relative to the window start (= committedMs).
    const commitCutoff = windowMs - LIVE_TAIL_MS;
    const toCommit = segments.filter((s) => s.endMs <= commitCutoff);
    const tail = segments.filter((s) => s.endMs > commitCutoff);

    const newlyCommittedText = toCommit.map((s) => s.text).join(" ").trim();
    if (toCommit.length) {
      state.committedText = `${state.committedText} ${newlyCommittedText}`.trim();
      state.committedMs += toCommit[toCommit.length - 1].endMs;
    }
    state.tailText = tail.map((s) => s.text).join(" ").trim();

    // Optional live translation, incremental like the transcript itself: only
    // newly-committed text gets a full translate; the short tail is
    // re-translated each pass. Best-effort -- any failure (or the translation
    // server being down) just means this pass returns transcript only.
    const pair = source && target && source !== target ? `${source}->${target}` : "";
    try {
      if (pair && (await isTranslationAvailable())) {
        if (state.languagePair !== pair) {
          // Language pair (re)selected mid-recording: re-translate what's
          // committed so far once, then continue incrementally.
          state.languagePair = pair;
          state.translatedCommitted = state.committedText
            ? await translateText(state.committedText, source, target)
            : "";
        } else if (newlyCommittedText) {
          const chunk = await translateText(newlyCommittedText, source, target);
          state.translatedCommitted = `${state.translatedCommitted} ${chunk}`.trim();
        }
        state.translatedTail = state.tailText ? await translateText(state.tailText, source, target) : "";
      } else if (!pair) {
        state.languagePair = "";
        state.translatedCommitted = "";
        state.translatedTail = "";
      }
    } catch (translationError) {
      console.error("live translation pass failed:", translationError);
    }

    liveState.set(key, state);
    return result();
  } finally {
    if (tmpWebm) fs.rmSync(tmpWebm, { force: true });
    if (wavPath) fs.rmSync(wavPath, { force: true });
  }
};

module.exports = { runLivePass, clearLiveState };
