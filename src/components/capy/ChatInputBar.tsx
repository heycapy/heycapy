import { forwardRef, useEffect, useImperativeHandle, useRef, useState, createElement } from "react";
import { notify } from "@/components/ui/notify";
import { cn } from "@/lib/utils";
import { InputBar, InputBarAction, InputBarIcon } from "@/components/ui/InputBar";
import { useLookParts } from "@/components/looks/LookProvider";
import { Sprite } from "./Sprite";
import { CAPY_NAME, VOICE_MAX_SECONDS } from "@/constants";
import { useLayoutStore } from "@/store/layout";
import { isTooShort, recordingFileName } from "./recording";

type Props = {
  input: string;
  setInput: (v: string) => void;
  streaming: boolean;
  onSend: () => void;
  onStop: () => void;
  centered?: boolean;
};

export type ChatInputBarHandle = { focus: () => void };

function formatTime(seconds: number) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export const ChatInputBar = forwardRef<ChatInputBarHandle, Props>(function ChatInputBar(
  { input, setInput, streaming, onSend, onStop, centered }: Props,
  ref
) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));

  const prevStreamingRef = useRef(streaming);
  useEffect(() => {
    if (prevStreamingRef.current && !streaming) inputRef.current?.focus();
    prevStreamingRef.current = streaming;
  }, [streaming]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    if (input) el.style.height = `${Math.min(el.scrollHeight, 80)}px`;
  }, [input]);

  useEffect(() => {
    if (!recording) {
      setRecSeconds(0);
      return;
    }
    const id = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  const micRequest = useLayoutStore((s) => s.micRequest);
  const handledMicRequest = useRef(micRequest);
  useEffect(() => {
    if (micRequest === handledMicRequest.current) return;
    handledMicRequest.current = micRequest;
    void handleMicClick();
  });

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  async function handleMicClick() {
    if (transcribing || streaming) return;

    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      notify.error("microphone access denied", {
        icon: createElement(Sprite, { id: "capy-error", size: 20 }),
      });
      return;
    }

    const mr = new MediaRecorder(stream);
    const startedAt = Date.now();
    chunksRef.current = [];
    const limit = setTimeout(() => {
      if (mr.state === "recording") mr.stop();
    }, VOICE_MAX_SECONDS * 1000);

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = async () => {
      clearTimeout(limit);
      stream.getTracks().forEach((t) => t.stop());
      setRecording(false);

      const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
      if (isTooShort(blob.size, Date.now() - startedAt)) {
        notify.error("didn't catch that", {
          description: "Hold the mic a bit longer while you talk.",
          icon: createElement(Sprite, { id: "capy-error", size: 20 }),
        });
        return;
      }
      setTranscribing(true);
      const fd = new FormData();
      fd.append("audio", blob, recordingFileName(blob.type));

      try {
        const res = await fetch("/api/transcribe", { method: "POST", body: fd });
        const body = (await res.json()) as { text?: string; error?: string };
        if (!res.ok || !body.text) {
          notify.error(res.status === 422 ? "didn't catch that" : "transcription failed", {
            description: body.error ?? "Unknown error.",
            icon: createElement(Sprite, { id: "capy-error", size: 20 }),
          });
        } else {
          setInput(body.text);
          setTimeout(() => {
            const el = inputRef.current;
            if (!el) return;
            el.focus();
            el.selectionStart = el.selectionEnd = el.value.length;
          }, 0);
        }
      } catch {
        notify.error("transcription failed", {
          description: "Could not reach the server.",
          icon: createElement(Sprite, { id: "capy-error", size: 20 }),
        });
      } finally {
        setTranscribing(false);
      }
    };

    mr.start();
    mediaRecorderRef.current = mr;
    setRecording(true);
  }

  const isRecordingOrTranscribing = recording || transcribing;
  const floating = useLookParts().footer === "floating";

  return (
    <div
      className={cn(
        "flex flex-col justify-center transition-colors",
        floating ? "px-3 pt-1 pb-3" : "border-t-frame",
        !floating && (recording ? "border-primary" : "border-border")
      )}
    >
      <div
        className={cn(
          centered && "mx-auto w-full max-w-[720px]",
          floating &&
            "rounded-panel border-frame shadow-raised bg-background transition-colors focus-within:border-(--ring)",
          floating && (recording ? "border-primary" : "border-border")
        )}
      >
        {isRecordingOrTranscribing ? (
          <InputBar>
            <span className="font-display flex min-w-0 flex-1 items-center gap-2 text-xs">
              {recording ? (
                <>
                  <span className="text-primary animate-[pulse_0.8s_ease-in-out_infinite]">●</span>
                  <span className="text-foreground truncate">
                    {CAPY_NAME} listening... {formatTime(recSeconds)}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground animate-pulse">
                  {CAPY_NAME}&apos;s jotting it down...
                </span>
              )}
            </span>
            {recording && (
              <InputBarAction
                icon="square"
                label="stop"
                name="stop recording"
                variant="destructive"
                onClick={() => mediaRecorderRef.current?.stop()}
              />
            )}
          </InputBar>
        ) : (
          <InputBar>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`ask ${CAPY_NAME}...`}
              rows={1}
              disabled={streaming}
              className="placeholder:text-muted-foreground/50 font-ui min-w-0 flex-1 resize-none bg-transparent py-1 text-base leading-6 outline-none disabled:opacity-50 sm:text-sm"
              style={{ maxHeight: 80 }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 80)}px`;
              }}
            />
            <InputBarIcon
              icon="mic"
              label="Record voice"
              tip="voice input"
              hint="mic"
              disabled={streaming}
              onClick={() => void handleMicClick()}
            />
            {streaming ? (
              <InputBarAction
                icon="square"
                label="stop"
                name="Stop"
                variant="destructive"
                onClick={onStop}
              />
            ) : (
              <InputBarAction
                icon="arrow-up"
                label="send"
                name="Send"
                disabled={!input.trim()}
                onClick={onSend}
              />
            )}
          </InputBar>
        )}
      </div>
    </div>
  );
});
