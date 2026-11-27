export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // Without a key there is nothing to pull; the app still serves stored data.
  const { hasGarminApiKey } = await import('./garmin');
  if (!hasGarminApiKey()) {
    console.warn('[sync] Garmin API key is not set; scheduler not started');
    return;
  }
  const { startSyncScheduler } = await import('./sync');
  await startSyncScheduler();
}
