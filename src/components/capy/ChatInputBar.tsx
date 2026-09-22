"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, createElement } from "react";
import { ArrowUp, Mic } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Sprite } from "./Sprite";

type Props = {
  input: string;
  setInput: (v: string) => void;
  streaming: boolean;
  onSend: () => void;
  onStop: () => void;
};

export type ChatInputBarHandle = { focus: () => void };

export const ChatInputBar = forwardRef<ChatInputBarHandle, Props>(function ChatInputBar(
  { input, setInput, streaming, onSend, onStop }: Props,
  ref
) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));
  const prevStreamingRef = useRef(streaming);

  useEffect(() => {
    if (prevStreamingRef.current && !streaming) {
      inputRef.current?.focus();
    }
    prevStreamingRef.current = streaming;
  }, [streaming]);

  useEffect(() => {
    if (!input && inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }, [input]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  async function handleMicClick() {
    if (transcribing) return;

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
    chunksRef.current = [];

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      setTranscribing(true);

      const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
      const fd = new FormData();
      fd.append("audio", blob, "recording.webm");

      try {
        const res = await fetch("/api/transcribe", { method: "POST", body: fd });
        const body = (await res.json()) as { text?: string; error?: string };
        if (!res.ok || !body.text) {
          toast.error("transcription failed", {
            description: body.error ?? "Unknown error.",
            icon: createElement(Sprite, { id: "capy-error", size: 28 }),
          });
        } else {
          setInput(body.text);
          setTimeout(() => inputRef.current?.focus(), 0);
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

  return (
    <div className="border-border flex items-end gap-2 border-t-2 px-3 py-2">
      <textarea
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="ask capy..."
        rows={1}
        disabled={streaming}
        className="scrollbar-hide placeholder:text-muted-foreground flex-1 resize-none bg-transparent font-mono text-xs outline-none disabled:opacity-50"
        style={{ maxHeight: 72 }}
        onInput={(e) => {
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = `${Math.min(el.scrollHeight, 72)}px`;
        }}
      />
      <button
        onClick={() => void handleMicClick()}
        disabled={streaming || transcribing}
        aria-label={recording ? "Stop recording" : "Record voice"}
        className={cn(
          "mb-0.5 shrink-0 border p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40",
          recording
            ? "border-destructive text-destructive animate-pulse"
            : "border-border text-muted-foreground hover:text-foreground"
        )}
      >
        <Mic size={12} />
      </button>
      {streaming ? (
        <button
          onClick={onStop}
          className="text-destructive border-destructive font-pixel mb-0.5 shrink-0 border px-1.5 py-0.5 text-[9px] transition-opacity hover:opacity-70"
          aria-label="Stop"
        >
          stop
        </button>
      ) : (
        <button
          onClick={onSend}
          disabled={!input.trim()}
          className={cn(
            "border-border mb-0.5 shrink-0 border p-1 transition-colors",
            input.trim()
              ? "bg-foreground text-background"
              : "text-muted-foreground cursor-not-allowed"
          )}
          aria-label="Send"
        >
          <ArrowUp size={12} />
        </button>
      )}
    </div>
  );
});
