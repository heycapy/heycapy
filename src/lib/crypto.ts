import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { WEBHOOK_KEY_PREFIX } from "@/constants";

export function generateWebhookKey(): string {
  return WEBHOOK_KEY_PREFIX + randomBytes(16).toString("hex");
}

const ALGORITHM = "aes-256-gcm";
const ENC_PREFIX = "enc:";

function getKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) return null;
  const buf = Buffer.from(raw, "hex");
  if (buf.length !== 32)
    throw new Error("ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)");
  return buf;
}

export function encryptValue(plain: string): string {
  const key = getKey();
  if (!key) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptValue(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored;
  const key = getKey();
  if (!key)
    throw new Error(
      "ENCRYPTION_KEY is not set but an encrypted value was found in the database. Set ENCRYPTION_KEY in your .env file."
    );
  const buf = Buffer.from(stored.slice(ENC_PREFIX.length), "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}
