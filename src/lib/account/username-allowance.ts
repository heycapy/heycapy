import type { UsernameAllowance } from "./username";

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function shortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function canChangeUsername({ nextFreeAt, bonus }: UsernameAllowance): boolean {
  return nextFreeAt === null || bonus > 0;
}

export function allowanceLine({ used, limit, bonus, nextFreeAt }: UsernameAllowance): string {
  if (nextFreeAt === null) {
    const left = `${Math.max(0, limit - used)} of ${limit} changes left this month`;
    return bonus > 0 ? `${left}, then ${bonus} bonus` : left;
  }
  if (bonus > 0) return `no monthly changes left · ${plural(bonus, "bonus change")} left`;
  return `no changes left · the next one opens on ${shortDate(nextFreeAt)}`;
}

// Asked before a save only when it uses the last monthly change or a bonus one
export function renameWarning(name: string, allowance: UsernameAllowance): string | null {
  const { used, limit, bonus, nextFreeAt } = allowance;
  if (nextFreeAt !== null) {
    return bonus > 0
      ? `rename to ${name}? this uses 1 of your ${plural(bonus, "bonus change")}`
      : null;
  }
  return limit - used === 1 ? `rename to ${name}? that's your last change this month` : null;
}
