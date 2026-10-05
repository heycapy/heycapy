import { forwardRef, useEffect, useImperativeHandle, useRef, useState, createElement } from "react";
import { ArrowUp, Mic } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Sprite } from "./Sprite";
import { VOICE_MAX_SECONDS } from "@/constants";
import { useAssistantName } from "./assistant-name";
import { isTooShort, recordingFileName } from "./recording";

type Props = {
  input: string;
  setInput: (v: string) => void;
  streaming: boolean;
  onSend: () => void;
  onStop: () => void;
};

export type ChatInputBarHandle = { focus: () => void };

function formatTime(seconds: number) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export const ChatInputBar = forwardRef<ChatInputBarHandle, Props>(function ChatInputBar(
  { input, setInput, streaming, onSend, onStop }: Props,
  ref
) {
  const name = useAssistantName();
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

  // Ctrl+Shift+M keybinding
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === "M") {
        e.preventDefault();
        void handleMicClick();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
      toast.error("microphone access denied", {
        icon: createElement(Sprite, { id: "capy-error", size: 28 }),
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
        toast.error("didn't catch that", {
          description: "Hold the mic a bit longer while you talk.",
          icon: createElement(Sprite, { id: "capy-error", size: 28 }),
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
          toast.error(res.status === 422 ? "didn't catch that" : "transcription failed", {
            description: body.error ?? "Unknown error.",
            icon: createElement(Sprite, { id: "capy-error", size: 28 }),
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
        toast.error("transcription failed", {
          description: "Could not reach the server.",
          icon: createElement(Sprite, { id: "capy-error", size: 28 }),
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

  return (
    <div
      className={cn(
        "border-t-2 px-3 py-2 transition-colors",
        recording ? "border-primary" : "border-border"
      )}
    >
      {isRecordingOrTranscribing ? (
        // as tall as the mic and send buttons so the bar keeps its height while capy listens
        <div className="flex min-h-9.5 items-center gap-3 md:min-h-6.5">
          <div className="flex flex-1 items-center gap-2">
            {recording ? (
              <>
                <span className="text-primary font-pixel animate-[pulse_0.8s_ease-in-out_infinite] text-xs">
                  ●
                </span>
                <span className="text-foreground font-pixel text-xs">
                  {name} listening... {formatTime(recSeconds)}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground font-pixel animate-pulse text-xs">
                {name}&apos;s jotting it down...
              </span>
            )}
          </div>

          {recording && (
            <button
              onClick={() => mediaRecorderRef.current?.stop()}
              className="border-primary text-foreground font-pixel shrink-0 border px-1.5 py-0.5 text-[11px] transition-opacity hover:opacity-70"
            >
              ■ stop
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`ask ${name}...`}
            rows={1}
            disabled={streaming}
            className="placeholder:text-muted-foreground flex-1 resize-none bg-transparent font-mono text-xs outline-none disabled:opacity-50"
            style={{ maxHeight: 80 }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 80)}px`;
            }}
          />
          <button
            onClick={() => void handleMicClick()}
            disabled={streaming}
            title="voice input (ctrl+shift+m)"
            aria-label="Record voice"
            className="border-border text-muted-foreground hover:border-foreground hover:text-foreground mb-0.5 shrink-0 border p-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 md:p-1"
          >
            <Mic size={14} />
          </button>
          {streaming ? (
            <button
              onClick={onStop}
              className="text-destructive border-destructive font-pixel mb-0.5 shrink-0 border px-2.5 py-2.5 text-[11px] transition-opacity hover:opacity-70 md:px-1.5 md:py-0.5 md:text-[11px]"
              aria-label="Stop"
            >
              stop
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={!input.trim()}
              className={cn(
                "border-border mb-0.5 shrink-0 border p-2.5 transition-colors md:p-1",
                input.trim()
                  ? "bg-foreground text-background"
                  : "text-muted-foreground cursor-not-allowed"
              )}
              aria-label="Send"
            >
              <ArrowUp size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
});
