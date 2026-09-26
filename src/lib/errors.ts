export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function parseProviderError(err: unknown): string {
  const raw = errorMessage(err);
  const match = raw.match(/\[(\{[\s\S]*\})\]$/);
  if (match?.[1]) {
    try {
      const body = JSON.parse(match[1]) as { error?: { message?: string } };
      if (body.error?.message) return body.error.message;
    } catch {}
  }
  return raw;
}

export function aiErrorResponse(err: unknown, tag: string): Response {
  process.stderr.write(`[${tag}] AI error: ${errorMessage(err)}\n`);
  return Response.json({ error: parseProviderError(err) }, { status: 502 });
}
