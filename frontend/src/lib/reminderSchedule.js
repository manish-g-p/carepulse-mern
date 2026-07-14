// Deterministic mapping from extracted timing phrases to a suggested dose
// schedule. Same philosophy as the key-item extraction itself: the system
// only SUGGESTS -- the doctor sees the proposed times, can edit them, and
// nothing exists until they click create.

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

// Frequency phrase -> dose times ("HH:mm"). First match wins, checked in
// order of specificity.
const FREQUENCY_TIMES = [
  [/three times|thrice/, ["08:00", "14:00", "20:00"]],
  [/twice|two times/, ["08:00", "20:00"]],
  [/after (meals|food|eating)/, ["08:30", "13:30", "20:30"]],
  [/before breakfast/, ["07:30"]],
  [/(in|every) the morning|every morning/, ["08:00"]],
  [/at (night|bedtime)|every night/, ["21:00"]],
  [/once|daily|every day/, ["08:00"]],
];

// "for five days" / "for 2 weeks" -> number of days.
const parseDurationDays = (text) => {
  const m = text.match(/for\s+(\d+|[a-z]+)\s+(day|days|week|weeks)/);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS[m[1]];
  if (!n) return null;
  return m[2].startsWith("week") ? n * 7 : n;
};

// keyItems ({ medications:[], timings:[] }) -> one suggested reminder per
// medication. All medications in a session share its timing phrases -- crude,
// but the doctor edits per-row before creating.
export const suggestReminders = (keyItems) => {
  const timings = keyItems?.timings || [];
  const joined = timings.join(", ").toLowerCase();

  let times = ["08:00"]; // fallback: once a day
  for (const [re, t] of FREQUENCY_TIMES) {
    if (re.test(joined)) {
      times = t;
      break;
    }
  }
  const durationDays = parseDurationDays(joined);

  return (keyItems?.medications || []).map((medication) => ({
    medication,
    timingLabel: timings.join(", "),
    times,
    durationDays,
  }));
};

// Whether a reminder is currently due (active, started, not past its end).
export const isReminderCurrent = (reminder) => {
  if (!reminder.active) return false;
  const now = new Date();
  if (reminder.startDate && new Date(reminder.startDate) > now) return false;
  if (reminder.endDate && new Date(reminder.endDate) < now) return false;
  return true;
};
