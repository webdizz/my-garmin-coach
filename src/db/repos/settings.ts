import { eq } from 'drizzle-orm';
import type { Db } from '../client';
import { settings } from '../schema';

/** Known settings and their value types. Extend as screens need new keys. */
export interface SettingsMap {
  units: 'metric' | 'imperial';
  'sync.hour': number;
}

export type SettingKey = keyof SettingsMap;

export function settingsRepo(db: Db) {
  return {
    async get<K extends SettingKey>(key: K): Promise<SettingsMap[K] | undefined> {
      const [row] = await db.select().from(settings).where(eq(settings.key, key));
      return row?.value as SettingsMap[K] | undefined;
    },

    async set<K extends SettingKey>(key: K, value: SettingsMap[K]): Promise<void> {
      await db
        .insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
    },

    async delete(key: SettingKey): Promise<void> {
      await db.delete(settings).where(eq(settings.key, key));
    },
  };
}
