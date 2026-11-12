import { LookPicker } from "./LookPicker";
import { ThemePicker } from "./ThemePicker";
import { ComfortSettings } from "./ComfortSettings";
import { FocusSetting } from "./FocusSetting";
import { BOX, SECTION } from "./settings-constants";

type AppearanceTabProps = {
  theme: string | undefined;
  setTheme: (t: string) => void;
};

export function AppearanceTab({ theme, setTheme }: AppearanceTabProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className={BOX}>
        <FocusSetting />
      </div>
      <div className={BOX}>
        <span className={SECTION}>look</span>
        <LookPicker />
      </div>
      <div className={BOX}>
        <span className={SECTION}>theme</span>
        <ThemePicker theme={theme} onPick={setTheme} />
      </div>
      <div className={BOX}>
        <span className={SECTION}>comfort</span>
        <ComfortSettings />
      </div>
    </div>
  );
}
