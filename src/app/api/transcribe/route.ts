import { eq } from "drizzle-orm";
import { requireApiSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { voiceContext } from "@/lib/transcription/hints";
import { decryptValue } from "@/lib/crypto";
import { readSavedAIKeys } from "@/lib/ai/saved-keys";
import { hasOwnAI } from "@/lib/ai";
import { recordUsage } from "@/lib/ai/usage";
import { creditBalance, isHosted } from "@/lib/credits";
import { serverVoice, transcribeAudio, type TranscriptionProvider } from "@/lib/transcription";
import { aiErrorResponse } from "@/lib/errors";
import {
  CREDITS_PER_MESSAGE,
  TRANSCRIPTION_DEFAULT_MODELS,
  OUT_OF_CREDITS_ERROR,
  VOICE_MAX_BYTES,
  VOICE_NO_SPEECH_ERROR,
  VOICE_TOO_LONG_ERROR,
} from "@/constants";

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

export async function POST(req: Request) {
  const [session, authErr] = await requireApiSession();
  if (authErr) return authErr;
  const userId = session.userId;

  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });

  // heycapy voice is free but only for users with credits left for the message it leads to
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
        voice.provider,
        voice.apiKey,
        voice.model,
        await voiceContext(userId, settings?.personalityName ?? "")
      );
      recordUsage({
        userId,
        sessionId: null,
        source: "voice",
        meta: { provider: voice.provider, model: voice.model, key: "server", price: voice.price },
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
  } else {
    apiKey = readSavedAIKeys(settings?.aiSavedKeys)[provider]?.apiKey ?? null;
  }

  if (!apiKey) {
    return Response.json(
      { error: "No API key for transcription. Add one in Settings → AI." },
      { status: 400 }
    );
  }

  const model = settings?.transcriptionModel || TRANSCRIPTION_DEFAULT_MODELS[provider];
  const audio = await readAudio(req);
  if (audio instanceof Response) return audio;

  try {
    const { text, usage } = await transcribeAudio(
      audio,
      provider,
      apiKey,
      model,
      await voiceContext(userId, settings?.personalityName ?? "")
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
