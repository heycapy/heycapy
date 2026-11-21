// public/sw.js deletes this database when the login page is visited, keep the name in step
export const SYNC_DB = "heycapy-sync";
export const SYNC_DB_VERSION = 3;

export const RECORDS_STORE = "records";
export const META_STORE = "meta";
export const QUEUE_STORE = "queue";
export const REJECTIONS_STORE = "rejections";
export const RECORDS_BY_BUCKET = "bucket";

export const META_CURSOR = "cursor";
export const META_DEVICE_ID = "deviceId";
export const META_SCHEMA = "schema";
export const META_USER_ID = "userId";

export const SYNC_LOCK = "heycapy-sync";
export const SYNC_CHANNEL = "heycapy-sync";

export const RETRY_BASE_MS = 2_000;
export const RETRY_MAX_MS = 5 * 60_000;
export const SYNC_NOW_TIMEOUT_MS = 20_000;
