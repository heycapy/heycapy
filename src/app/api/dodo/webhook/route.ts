import { dodoEnabled, handleDodoWebhook } from "@/lib/billing/dodo";

//NOTE: dodo calls this with a signed body; the signature is the only credential, so the raw text goes to the check as is
export async function POST(request: Request) {
  if (!dodoEnabled()) return Response.json({ message: "billing is off" }, { status: 404 });
  const { status, message } = await handleDodoWebhook(await request.text(), request.headers);
  return Response.json({ message }, { status });
}
