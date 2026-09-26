import { requireApiSession } from "@/lib/auth/session";
import { dataEvents } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [session, authErr] = await requireApiSession();
  if (authErr) return authErr;

  const { userId } = session;
  const encoder = new TextEncoder();

  let cleanup: () => void;

  const stream = new ReadableStream({
    start(controller) {
      const onRefresh = (eventUserId: number) => {
        if (eventUserId !== userId) return;
        try {
          controller.enqueue(encoder.encode("data: refresh\n\n"));
        } catch {
          // client disconnected
        }
      };

      dataEvents.on("refresh", onRefresh);

      // Keepalive ping every 25s so proxies don't close the connection
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(ping);
        }
      }, 25_000);

      cleanup = () => {
        dataEvents.off("refresh", onRefresh);
        clearInterval(ping);
      };
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
