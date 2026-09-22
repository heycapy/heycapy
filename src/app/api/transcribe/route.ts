import { eq } from "drizzle-orm";
import { requireApiSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { decryptValue } from "@/lib/crypto";
import { transcribeAudio } from "@/lib/transcription";
import { aiErrorResponse } from "@/lib/errors";

export async function POST(req: Request) {
  const [session, authErr] = await requireApiSession();
  if (authErr) return authErr;

  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, session.userId),
  });

  const provider = settings?.transcriptionProvider as "groq" | "openai" | null | undefined;
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

  const model =
    settings?.transcriptionModel || (provider === "groq" ? "whisper-large-v3-turbo" : "whisper-1");

  let audio: File | null = null;
  try {
    const formData = await req.formData();
    const entry = formData.get("audio");
    if (entry instanceof File) audio = entry;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!audio) {
    return Response.json({ error: "Missing audio file." }, { status: 400 });
  }

  try {
    const text = await transcribeAudio(audio, provider, apiKey, model);
    return Response.json({ text });
  } catch (err) {
    return aiErrorResponse(err, "transcribe");
  }
}
