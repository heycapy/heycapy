import OpenAI from "openai";
import {
  AI_REQUEST_TIMEOUT_MS,
  GEMINI_DEFAULT_MODEL,
  GEMINI_NATIVE_API_BASE,
  GROQ_API_BASE,
} from "@/constants";
import type { TokenUsage } from "@/lib/ai/types";

export type TranscriptionProvider = "groq" | "openai" | "gemini";
export type Transcript = { text: string; usage: TokenUsage };

function geminiPrompt(hints: string[]): string {
  const names = hints.length > 0 ? ` Names they may say: ${hints.join(", ")}.` : "";
  return (
    "Transcribe this voice note for a reminders app. It is usually a quick request to add or change something, " +
    "with titles, dates, times and amounts; keep them exactly as said. Keep the speaker's language and words, " +
    `never translate or summarise.${names} If there is no speech, only noise or silence, set speech to false.`
  );
}

// A forced shape: asked for plain text, Gemini labels a silent recording "<noise>" instead of leaving it empty
const GEMINI_TRANSCRIPT_SCHEMA = {
  type: "OBJECT",
  properties: { speech: { type: "BOOLEAN" }, text: { type: "STRING" } },
  required: ["speech", "text"],
};

const NON_SPEECH_LABEL = /^\s*[<[(][^>\])]*[>\])]\s*$/;

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    cachedContentTokenCount?: number;
  };
  error?: { message?: string };
};

// Safari records MP4 audio, which Gemini knows as m4a; codec parameters aren't part of its types
function geminiMimeType(type: string): string {
  const base = type.split(";")[0].trim() || "audio/webm";
  return base === "audio/mp4" ? "audio/m4a" : base;
}

async function transcribeWithGemini(
  audio: File,
  apiKey: string,
  model: string,
  hints: string[]
): Promise<Transcript> {
  const res = await fetch(
    `${GEMINI_NATIVE_API_BASE}/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: geminiPrompt(hints) },
              {
                inline_data: {
                  mime_type: geminiMimeType(audio.type),
                  data: Buffer.from(await audio.arrayBuffer()).toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: GEMINI_TRANSCRIPT_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    }
  );
  const body = (await res.json().catch(() => ({}))) as GeminiResponse;
  if (!res.ok) {
    throw new Error(`Gemini error: ${body.error?.message ?? `${res.status} ${res.statusText}`}`);
  }

  const raw = (body.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  let heard: { speech?: unknown; text?: unknown };
  try {
    heard = JSON.parse(raw) as { speech?: unknown; text?: unknown };
  } catch {
    throw new Error("Gemini sent back a transcript capy couldn't read. Try again.");
  }
  const text = heard.speech === true && typeof heard.text === "string" ? heard.text.trim() : "";

  const usage = body.usageMetadata;
  return {
    text: NON_SPEECH_LABEL.test(text) ? "" : text,
    usage: usage
      ? {
          inputTokens: usage.promptTokenCount ?? 0,
          outputTokens: usage.candidatesTokenCount ?? 0,
          cacheReadTokens: usage.cachedContentTokenCount ?? 0,
          cacheWriteTokens: 0,
        }
      : null,
  };
}

// hints: words the user is likely to say, such as their bucket names
export async function transcribeAudio(
  audio: File,
  provider: TranscriptionProvider,
  apiKey: string,
  model: string,
  hints: string[] = []
): Promise<Transcript> {
  if (provider === "gemini") return transcribeWithGemini(audio, apiKey, model, hints);

  const client =
    provider === "groq" ? new OpenAI({ apiKey, baseURL: GROQ_API_BASE }) : new OpenAI({ apiKey });
  const response = await client.audio.transcriptions.create({ file: audio, model, language: "en" });
  return { text: response.text, usage: null };
}

// heycapy's own voice for users on heycapy ai: Gemini on the server's key
export function serverVoice(): { apiKey: string; model: string } | null {
  const apiKey =
    process.env.GEMINI_API_KEY ??
    (process.env.AI_PROVIDER === "gemini" ? process.env.AI_API_KEY : undefined);
  if (!apiKey) return null;
  return { apiKey, model: process.env.VOICE_MODEL ?? GEMINI_DEFAULT_MODEL };
}
