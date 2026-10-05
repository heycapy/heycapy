import { VOICE_MIN_MS } from "@/constants";

// Providers read the format from the file name, and Safari records mp4 where Chrome records webm
export function recordingFileName(mimeType: string): string {
  const type = mimeType.toLowerCase();
  if (type.includes("mp4") || type.includes("aac")) return "recording.m4a";
  if (type.includes("ogg")) return "recording.ogg";
  return "recording.webm";
}

export function isTooShort(blobSize: number, recordedMs: number): boolean {
  return blobSize === 0 || recordedMs < VOICE_MIN_MS;
}
