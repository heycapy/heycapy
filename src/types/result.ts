// What server actions return: data on success, a message the UI can show on failure
export type ActionResult<T extends object = object> =
  ({ ok: true } & T) | { ok: false; error: string };
