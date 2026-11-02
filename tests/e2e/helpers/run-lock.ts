import { readFileSync, rmSync, writeFileSync } from "node:fs";

const LOCK_FILE = ".e2e/run.lock";

function holder(): number | null {
  try {
    const pid = Number(readFileSync(LOCK_FILE, "utf8"));
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

// Every run shares the server on one port and its database, and global setup resets the test
// accounts, so a second run would delete the first one's users mid-test. A run killed without
// cleaning up leaves its pid behind, which is taken over once that process is gone
export function holdRunLock() {
  try {
    writeFileSync(LOCK_FILE, String(process.pid), { flag: "wx" });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    const pid = holder();
    if (pid !== null && pid !== process.pid && alive(pid)) {
      throw new Error(
        `Another E2E run (pid ${pid}) is using the test server and database. Wait for it to finish, or delete ${LOCK_FILE} if no run is going.`
      );
    }
    writeFileSync(LOCK_FILE, String(process.pid));
  }
  process.on("exit", () => {
    if (holder() === process.pid) rmSync(LOCK_FILE, { force: true });
  });
}
