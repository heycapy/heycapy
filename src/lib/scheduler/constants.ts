export const SCHEDULER_AI_TIMEOUT_MS = 8_000;
// No finished run for this long means the scheduler is stuck
export const SCHEDULER_STALE_MS = 5 * 60 * 1000;
// restart if stuck for this long
export const SCHEDULER_WATCHDOG_MS = 10 * 60 * 1000;
