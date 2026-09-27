export function isE2ETestMode(): boolean {
  return process.env.E2E_TEST_MODE === "1";
}
