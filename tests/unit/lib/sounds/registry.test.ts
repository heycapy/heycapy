import { describe, expect, it } from "vitest";
import { DEFAULT_TICK_SOUND, TICK_SOUNDS } from "@/constants";
import { SOUND_IDS, SOUNDS } from "@/lib/sounds";

describe("sounds", () => {
  it("offers off, then every registered sound, with chime as the default", () => {
    expect(TICK_SOUNDS).toEqual(["off", "chime", "sparkle", "success", "harp"]);
    expect(SOUND_IDS).toContain(DEFAULT_TICK_SOUND);
  });

  it.each(SOUND_IDS)("%s is playable data", (id) => {
    const { source } = SOUNDS[id];
    if (source.kind === "file") {
      expect(source.url).not.toBe("");
      return;
    }
    expect(source.voices.length).toBeGreaterThan(0);
    for (const voice of source.voices) {
      expect(voice.freq).toBeGreaterThan(0);
      expect(voice.gain).toBeGreaterThan(0);
      expect(voice.at ?? 0).toBeGreaterThanOrEqual(0);
      if (voice.kind === "tone") {
        for (const [ratio, level, seconds] of voice.partials) {
          expect(ratio).toBeGreaterThan(0);
          expect(level).toBeGreaterThan(0);
          expect(seconds).toBeGreaterThan(0);
        }
      } else {
        expect(voice.seconds).toBeGreaterThan(0);
        expect(voice.bright).toBeGreaterThanOrEqual(0);
        expect(voice.bright).toBeLessThanOrEqual(1);
      }
    }
  });
});
