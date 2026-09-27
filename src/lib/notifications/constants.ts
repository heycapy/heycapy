export const QUEUE_DEFAULT_MAX_ATTEMPTS = 3;
export const QUEUE_PROCESS_BATCH_SIZE = 50;
export const QUEUE_RETRY_DELAY_MINS = [1, 5, 15] as const;
export const QUEUE_SENDING_LEASE_MS = 10 * 60 * 1000;
export const CHANNEL_FAILURE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const WEBHOOK_RATE_LIMIT_MAX = 120;
export const WEBHOOK_RATE_LIMIT_WINDOW_MS = 60_000;
