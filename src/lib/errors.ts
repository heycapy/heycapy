import { APIConnectionTimeoutError as OpenAIConnectionTimeoutError, OpenAIError } from "openai";
import {
  AnthropicError,
  APIConnectionTimeoutError as AnthropicConnectionTimeoutError,
} from "@anthropic-ai/sdk";
import { AI_TIMEOUT_ERROR } from "@/constants";

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function providerMessage(err: unknown): string | null {
  if (!(err instanceof OpenAIError || err instanceof AnthropicError) || !("error" in err)) {
    return null;
  }
  const body = err.error as { message?: unknown; error?: { message?: unknown } } | undefined;
  const message = body?.message ?? body?.error?.message;
  return typeof message === "string" && message ? message : null;
}

export function parseProviderError(err: unknown): string {
  if (
    err instanceof OpenAIConnectionTimeoutError ||
    err instanceof AnthropicConnectionTimeoutError
  ) {
    return AI_TIMEOUT_ERROR;
  }
  const fromProvider = providerMessage(err);
  if (fromProvider) return fromProvider;
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

export function logAIError(err: unknown, tag: string): void {
  process.stderr.write(`[${tag}] AI error: ${errorMessage(err)}\n`);
}

export function aiErrorResponse(err: unknown, tag: string): Response {
  logAIError(err, tag);
  return Response.json({ error: parseProviderError(err) }, { status: 502 });
}
