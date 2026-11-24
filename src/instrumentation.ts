export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // Without a key there is nothing to pull; the app still serves stored data.
  if (!process.env.GARMIN_CONNECT_API_KEY) {
    console.warn('[sync] GARMIN_CONNECT_API_KEY is not set; scheduler not started');
    return;
  }
  const { startSyncScheduler } = await import('./sync');
  await startSyncScheduler();
}
