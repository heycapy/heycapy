import Database from "better-sqlite3";
import { E2E_DATABASE_FILE } from "./env";

// A public test address: nothing is delivered in E2E, the host only has to pass the hosted check
const E2E_SMTP_HOST = "203.0.113.10";

// On the hosted app email only works through a person's own smtp
export function giveOwnSmtp(email: string): void {
  const db = new Database(E2E_DATABASE_FILE);
  db.prepare(
    "update user_settings set email_provider = 'smtp', smtp_host = ? where user_id = (select id from users where email = ?)"
  ).run(E2E_SMTP_HOST, email);
  db.close();
}
