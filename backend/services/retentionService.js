// Generic retention runner (Day 27). Each service owns the retention of ITS
// data (the same ownership rule as everything else post-split): the
// conversation service ages out completed sessions, the notification service
// purges long-expired reminders. Both are driven by one env knob:
//
//   RETENTION_DAYS   e.g. 365 -- records older than this are hard-deleted.
//                    UNSET (the default) means retention is DISABLED; nothing
//                    is ever deleted automatically unless explicitly opted in.
//
// Sweeps run at service startup and then daily. Deletion is hard (same as
// the right-to-delete endpoint) -- there is no soft-delete tier on the $0
// stack, which is also why disabled-by-default matters.
const DAY_MS = 24 * 60 * 60 * 1000;

const scheduleRetention = (label, sweep) => {
  const days = Number(process.env.RETENTION_DAYS);
  if (!Number.isFinite(days) || days <= 0) {
    console.log(`[retention] disabled for ${label} (RETENTION_DAYS not set)`);
    return null;
  }

  const run = async () => {
    try {
      const removed = await sweep(days);
      console.log(`[retention] ${label}: removed ${removed} record(s) older than ${days} day(s)`);
    } catch (error) {
      console.error(`[retention] ${label} sweep failed:`, error);
    }
  };

  run();
  const timer = setInterval(run, DAY_MS);
  timer.unref?.(); // never keep the process alive just for the sweep
  return timer;
};

const retentionCutoff = (days) => new Date(Date.now() - days * DAY_MS);

module.exports = { scheduleRetention, retentionCutoff };
