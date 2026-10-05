import { expect, it } from "vitest";
import { VOICE_MIN_MS } from "@/constants";
import { isTooShort, recordingFileName } from "@/components/capy/recording";

it.each([
  ["audio/webm;codecs=opus", "recording.webm"],
  ["audio/mp4", "recording.m4a"],
  ["audio/aac", "recording.m4a"],
  ["audio/ogg;codecs=opus", "recording.ogg"],
  ["", "recording.webm"],
])("names a %j recording %s so providers read the right format", (type, name) => {
  expect(recordingFileName(type)).toBe(name);
});

it("treats an empty file or a quick tap as too short", () => {
  expect(isTooShort(0, 5000)).toBe(true);
  expect(isTooShort(900, VOICE_MIN_MS - 1)).toBe(true);
  expect(isTooShort(900, VOICE_MIN_MS)).toBe(false);
});
