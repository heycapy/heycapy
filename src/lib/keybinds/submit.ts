export function submitKeys(isMac: boolean, form: boolean): string {
  if (!form) return "Enter";
  return isMac ? "Cmd+Enter" : "Ctrl+Enter";
}
