import OpenAI from "openai";
import {
  AI_REQUEST_TIMEOUT_MS,
  GEMINI_NATIVE_API_BASE,
  GROQ_API_BASE,
  TRANSCRIPTION_DEFAULT_MODELS,
  TRANSCRIPTION_PROVIDERS,
  WHISPER_PROMPT_MAX_LENGTH,
  type TranscriptionProvider,
} from "@/constants";
import type { TokenUsage } from "@/lib/ai/types";
import type { VoiceContext } from "./hints";

export type { TranscriptionProvider } from "@/constants";
export type Transcript = { text: string; usage: TokenUsage };

function geminiPrompt({ assistant, names }: VoiceContext): string {
  return (
    `This is a voice note to ${assistant} (also "hey ${assistant}"), the assistant in the heycapy reminders app. ` +
    "It is usually a quick request to add or change something, with titles, dates, times and amounts; " +
    "keep them exactly as said. Keep the speaker's language and words, never translate or summarise. " +
    `Names the user may say, spelled like this: ${names.join(", ")}. ` +
    "If there is no speech, only noise or silence, set speech to false."
  );
}

// whisper takes a list of spellings not instructions and at most 224 tokens
function whisperPrompt({ names }: VoiceContext): string {
  let prompt = "";
  for (const name of names) {
    const next = prompt ? `${prompt}, ${name}` : name;
    if (next.length > WHISPER_PROMPT_MAX_LENGTH) break;
    prompt = next;
  }
  return prompt;
}

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

// safari records mp4 which gemini calls m4a and codec parameters are not part of its types
function geminiMimeType(type: string): string {
  const base = type.split(";")[0].trim() || "audio/webm";
  return base === "audio/mp4" ? "audio/m4a" : base;
}

async function transcribeWithGemini(
  audio: File,
  apiKey: string,
  model: string,
  context: VoiceContext
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
              { text: geminiPrompt(context) },
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

export async function transcribeAudio(
  audio: File,
  provider: TranscriptionProvider,
  apiKey: string,
  model: string,
  context: VoiceContext
): Promise<Transcript> {
  if (provider === "gemini") return transcribeWithGemini(audio, apiKey, model, context);

  const client =
    provider === "groq" ? new OpenAI({ apiKey, baseURL: GROQ_API_BASE }) : new OpenAI({ apiKey });
  const response = await client.audio.transcriptions.create({
    file: audio,
    model,
    language: "en",
    prompt: whisperPrompt(context),
  });
  return { text: response.text, usage: null };
}

// set on its own and never taken from the chat ai so voice stays off until both are set
export function serverVoice(): {
  provider: TranscriptionProvider;
  apiKey: string;
  model: string;
} | null {
  const provider = TRANSCRIPTION_PROVIDERS.find((p) => p === process.env.VOICE_PROVIDER);
  const apiKey = process.env.VOICE_API_KEY;
  if (!provider || !apiKey) return null;
  return {
    provider,
    apiKey,
    model: process.env.VOICE_MODEL || TRANSCRIPTION_DEFAULT_MODELS[provider],
  };
}
