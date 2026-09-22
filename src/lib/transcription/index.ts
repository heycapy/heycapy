import OpenAI from "openai";
import { GROQ_API_BASE } from "@/constants";

export async function transcribeAudio(
  audio: File,
  provider: "groq" | "openai",
  apiKey: string,
  model: string
): Promise<string> {
  const client =
    provider === "groq" ? new OpenAI({ apiKey, baseURL: GROQ_API_BASE }) : new OpenAI({ apiKey });

  const response = await client.audio.transcriptions.create({ file: audio, model });
  return response.text;
}
