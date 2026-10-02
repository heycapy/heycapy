import { AI_REQUEST_TIMEOUT_MS } from "@/constants";

// No silent retries: the SDKs would wait out a rate limit (up to a minute) and the user would only see a timeout
export const AI_CLIENT_OPTIONS = { maxRetries: 0, timeout: AI_REQUEST_TIMEOUT_MS };
