import { requireApiSession } from "@/lib/auth/session";
import { dataEvents } from "@/lib/events";
import { isBucketMember } from "@/lib/buckets/access";
import { recordSystemError } from "@/lib/system-errors";
import { SERVER_VERSION_EVENT } from "@/constants";

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
      const send = () => {
        try {
          controller.enqueue(encoder.encode("data: refresh\n\n"));
        } catch {
          // client disconnected
        }
      };
      const onRefresh = (eventUserId: number) => {
        if (eventUserId === userId) send();
      };
      const onBucket = (bucketId: number) => {
        isBucketMember(userId, bucketId)
          .then((member) => {
            if (member) send();
          })
          .catch((err: unknown) => {
            recordSystemError("events", `bucket ${bucketId} refresh failed`, { userId, err });
          });
      };

      dataEvents.on("refresh", onRefresh);
      dataEvents.on("bucket", onBucket);

      // A deploy restarts the server, so every open app hears the new version as it reconnects
      const version = process.env.NEXT_DEPLOYMENT_ID;
      if (version) {
        controller.enqueue(encoder.encode(`event: ${SERVER_VERSION_EVENT}\ndata: ${version}\n\n`));
      }

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
        dataEvents.off("bucket", onBucket);
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
