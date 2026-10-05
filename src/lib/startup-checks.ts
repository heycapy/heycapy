import { JWT_SECRET_MIN_LENGTH, SECRET_PLACEHOLDER_PREFIX } from "@/constants";
import { isLocalUrl } from "@/lib/app-url";

const MAKE_JWT_SECRET = "generate one with: openssl rand -base64 32";
const MAKE_ENCRYPTION_KEY = "generate one with: openssl rand -hex 32";

function isSet(value: string | undefined): value is string {
  return !!value && !value.startsWith(SECRET_PLACEHOLDER_PREFIX);
}

export function secretProblems(env: Record<string, string | undefined>): string[] {
  const problems: string[] = [];
  const jwtSecret = env.JWT_SECRET;
  const encryptionKey = env.ENCRYPTION_KEY;

  if (!isSet(jwtSecret)) {
    problems.push(`JWT_SECRET is not set, ${MAKE_JWT_SECRET}`);
  } else if (jwtSecret.length < JWT_SECRET_MIN_LENGTH) {
    problems.push(
      `JWT_SECRET is ${jwtSecret.length} characters, it needs at least ${JWT_SECRET_MIN_LENGTH}, ${MAKE_JWT_SECRET}`
    );
  }

  if (!isSet(encryptionKey)) {
    problems.push(`ENCRYPTION_KEY is not set, ${MAKE_ENCRYPTION_KEY}`);
  } else if (!/^[0-9a-f]{64}$/i.test(encryptionKey)) {
    problems.push(`ENCRYPTION_KEY must be 64 hex characters, ${MAKE_ENCRYPTION_KEY}`);
  }

  return problems;
}

const EXAMPLE_VALUE = /yourdomain\.com|^re_\.\.\.$/;

export function productionProblems(env: Record<string, string | undefined>): string[] {
  const problems = Object.entries(env)
    .filter(([, value]) => value && EXAMPLE_VALUE.test(value))
    .map(([name]) => `${name} is still the example value from .env.example`);

  if (!env.APP_URL || !/^https?:\/\//.test(env.APP_URL)) {
    problems.push(
      "APP_URL is not set, set it to the address heycapy is opened at, e.g. https://heycapy.example.com (or http://localhost to try it on this machine)"
    );
  } else if (!env.RESEND_API_KEY && !env.SMTP_HOST && !isLocalUrl(env.APP_URL)) {
    problems.push(
      "no email is set up, set RESEND_API_KEY or SMTP_HOST so sign in codes can be sent. without one the codes would show on the sign in screen and anyone could sign in as anyone (fine only on this machine: APP_URL=http://localhost)"
    );
  }
  return problems;
}

// Throwing in register() only logs: Next.js keeps running and answers every request with a 500
export function refuseToStart(problems: string[]): never {
  process.stderr.write(
    `heycapy can't start, set these in .env or your host's secrets:\n- ${problems.join("\n- ")}\n`
  );
  process.exit(1);
}
