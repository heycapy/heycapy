// Operators of this instance, from ADMIN_EMAILS (comma-separated)
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(email: string): boolean {
  return adminEmails().includes(email.toLowerCase());
}
