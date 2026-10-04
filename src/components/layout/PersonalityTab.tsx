import { cn } from "@/lib/utils";
import { charCountColor } from "@/components/ui/input";
import { Toggle } from "@/components/ui/Toggle";
import { OptionGroup } from "@/components/ui/OptionGroup";
import { LABEL, INPUT, TONE_OPTIONS } from "./settings-constants";
import type { UserTone } from "./settings-constants";
import { PERSONALITY_NAME_MAX_LENGTH, CUSTOM_PROMPT_MAX_LENGTH } from "@/constants";

type PersonalityTabProps = {
  personalityName: string;
  setPersonalityName: (v: string) => void;
  personalityTone: UserTone;
  setPersonalityTone: (v: UserTone) => void;
  personalityCustomPrompt: string;
  setPersonalityCustomPrompt: (v: string) => void;
  personalityEmoji: boolean;
  setPersonalityEmoji: (v: boolean) => void;
  pending: boolean;
};

export function PersonalityTab({
  personalityName,
  setPersonalityName,
  personalityTone,
  setPersonalityTone,
  personalityCustomPrompt,
  setPersonalityCustomPrompt,
  personalityEmoji,
  setPersonalityEmoji,
  pending,
}: PersonalityTabProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>name</label>
        <input
          type="text"
          value={personalityName}
          onChange={(e) => setPersonalityName(e.target.value)}
          placeholder="Capy"
          maxLength={PERSONALITY_NAME_MAX_LENGTH}
          disabled={pending}
          className={INPUT}
        />
        {personalityName.length > 0 && (
          <p
            className={cn(
              "text-right font-mono text-[11px] transition-colors",
              charCountColor(personalityName.length, PERSONALITY_NAME_MAX_LENGTH)
            )}
          >
            {personalityName.length}/{PERSONALITY_NAME_MAX_LENGTH}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>tone</label>
        <OptionGroup
          options={TONE_OPTIONS}
          value={personalityTone}
          onChange={setPersonalityTone}
          disabled={pending}
        />
      </div>
      {personalityTone === "custom" && (
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>custom prompt</label>
          <textarea
            value={personalityCustomPrompt}
            onChange={(e) => setPersonalityCustomPrompt(e.target.value)}
            placeholder="Describe the tone and style..."
            maxLength={CUSTOM_PROMPT_MAX_LENGTH}
            disabled={pending}
            rows={4}
            className="border-border placeholder:text-muted-foreground/50 focus:border-foreground w-full resize-none border-b bg-transparent py-1.5 font-mono text-xs outline-none disabled:opacity-50"
          />
          <p className="text-muted-foreground font-mono text-[11px]">
            only how it should sound, like &quot;talk like a pirate&quot;. keep it friendly: prompts
            that ask for anything else are refused.
          </p>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>use emoji</label>
        <Toggle value={personalityEmoji} onChange={setPersonalityEmoji} disabled={pending} />
      </div>
    </>
  );
}
