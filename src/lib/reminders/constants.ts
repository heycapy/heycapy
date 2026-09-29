export const OVERDUE_FIRST_ALERT_DEFAULT_MINS = 60;
export const REMINDER_BATCH_SIZE = 100;
export const REMINDER_MAX_BATCHES_PER_RUN = 50;
export const REMINDER_RETRY_DELAY_MS = 5 * 60 * 1000;
export const RECONCILE_BATCH_SIZE = 500;
// When an all-day item reminds, unless the bucket sets "remind at"
export const ALL_DAY_REMINDER_MINS = 9 * 60;
// Moving a time out of one blocked window can land it in another, so it takes a few jumps;
// real settings need 1–2, and the limit stops a day with no allowed time from looping forever
export const MAX_DELIVERY_WINDOW_JUMPS = 4;
