import { and, eq, isNull } from "drizzle-orm";
import { requireApiSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { buckets, userSettings } from "@/lib/db/schema";
import { decryptValue } from "@/lib/crypto";
import { hasOwnAI } from "@/lib/ai";
import { recordUsage } from "@/lib/ai/usage";
import { creditBalance, isHosted } from "@/lib/credits";
import { serverVoice, transcribeAudio, type TranscriptionProvider } from "@/lib/transcription";
import { aiErrorResponse } from "@/lib/errors";
import {
  CREDITS_PER_MESSAGE,
  GEMINI_DEFAULT_MODEL,
  OUT_OF_CREDITS_ERROR,
  VOICE_MAX_BYTES,
  VOICE_NO_SPEECH_ERROR,
  VOICE_TOO_LONG_ERROR,
} from "@/constants";

const DEFAULT_MODELS: Record<TranscriptionProvider, string> = {
  groq: "whisper-large-v3-turbo",
  openai: "whisper-1",
  gemini: GEMINI_DEFAULT_MODEL,
};

async function readAudio(req: Request): Promise<File | Response> {
  try {
    const entry = (await req.formData()).get("audio");
    if (entry instanceof File) return entry;
    return Response.json({ error: "Missing audio file." }, { status: 400 });
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
}

function transcriptResponse(text: string): Response {
  if (!text) return Response.json({ error: VOICE_NO_SPEECH_ERROR }, { status: 422 });
  return Response.json({ text });
}

// So a spoken bucket name comes back spelled the way the user wrote it
async function bucketNames(userId: number): Promise<string[]> {
  const rows = await db
    .select({ name: buckets.name })
    .from(buckets)
    .where(and(eq(buckets.userId, userId), isNull(buckets.deletedAt)));
  return rows.map((r) => r.name);
}

export async function POST(req: Request) {
  const [session, authErr] = await requireApiSession();
  if (authErr) return authErr;
  const userId = session.userId;

  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });

  // Users on heycapy's AI get heycapy's voice; it's free, but only as a way into a paid message
  const onHeycapyAI =
    isHosted() &&
    !hasOwnAI({
      provider: settings?.aiProvider,
      apiKey: settings?.aiApiKey,
      ollamaUrl: settings?.aiOllamaUrl,
      useOwnKey: settings?.aiUseOwnKey,
    });
  if (onHeycapyAI) {
    const voice = serverVoice();
    if (!voice) {
      return Response.json({ error: "Voice isn't set up on this server." }, { status: 503 });
    }
    if (creditBalance(userId) < CREDITS_PER_MESSAGE) {
      return Response.json({ error: OUT_OF_CREDITS_ERROR }, { status: 402 });
    }
    const audio = await readAudio(req);
    if (audio instanceof Response) return audio;
    if (audio.size > VOICE_MAX_BYTES) {
      return Response.json({ error: VOICE_TOO_LONG_ERROR }, { status: 413 });
    }
    try {
      const { text, usage } = await transcribeAudio(
        audio,
        "gemini",
        voice.apiKey,
        voice.model,
        await bucketNames(userId)
      );
      recordUsage({
        userId,
        sessionId: null,
        source: "voice",
        meta: { provider: "gemini", model: voice.model, key: "server" },
        calls: [usage],
      });
      return transcriptResponse(text);
    } catch (err) {
      return aiErrorResponse(err, "transcribe");
    }
  }

  const provider = settings?.transcriptionProvider as TranscriptionProvider | null | undefined;
  if (!provider) {
    return Response.json(
      { error: "Transcription not configured. Set a provider in Settings → AI." },
      { status: 400 }
    );
  }

  let apiKey: string | null = null;
  if (settings?.transcriptionApiKey) {
    apiKey = decryptValue(settings.transcriptionApiKey);
  } else if (provider === settings?.aiProvider && settings?.aiApiKey) {
    apiKey = decryptValue(settings.aiApiKey);
  }

  if (!apiKey) {
    return Response.json(
      { error: "No API key for transcription. Add one in Settings → AI." },
      { status: 400 }
    );
  }

  const model = settings?.transcriptionModel || DEFAULT_MODELS[provider];
  const audio = await readAudio(req);
  if (audio instanceof Response) return audio;

  try {
    const { text, usage } = await transcribeAudio(
      audio,
      provider,
      apiKey,
      model,
      await bucketNames(userId)
    );
    if (usage) {
      recordUsage({
        userId,
        sessionId: null,
        source: "voice",
        meta: { provider, model, key: "own" },
        calls: [usage],
      });
    }
    return transcriptResponse(text);
  } catch (err) {
    return aiErrorResponse(err, "transcribe");
  }
}
