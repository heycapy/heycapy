// Asks the browser to keep this site's storage. Called when there is something to protect, since
// Firefox shows the person a prompt for it
export async function keepStorage(): Promise<void> {
  try {
    if (!navigator.storage?.persist || (await navigator.storage.persisted())) return;
    await navigator.storage.persist();
  } catch {}
}
