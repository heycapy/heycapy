import { z } from "zod";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { getAIProvider } from "@/lib/ai";

const bodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    })
  ),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return new Response("Bad request", { status: 400 });
  }

  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, session.userId),
  });

  const { messages } = parsed.data;
  const provider = getAIProvider({
    provider: settings?.aiProvider,
    model: settings?.aiModel,
    apiKey: settings?.aiApiKey,
    ollamaUrl: settings?.aiOllamaUrl,
  });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of provider.chat(messages)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
