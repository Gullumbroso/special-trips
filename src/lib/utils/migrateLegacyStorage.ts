/**
 * Migrates legacy localStorage keys to new architecture
 * Run this once on app initialization to clean up old keys
 */
export function migrateLegacyStorage(): void {
  if (typeof window === 'undefined') return;

  const legacyKeys = [
    'special-trips-response-id',
    'special-trips-cursor',
    'special-trips-session-id',
  ];

  let cleaned = false;

  legacyKeys.forEach(key => {
    if (localStorage.getItem(key) !== null) {
      console.log(`[Migration] Removing legacy key: ${key}`);
      localStorage.removeItem(key);
      cleaned = true;
    }
  });

  if (cleaned) {
    console.log('[Migration] ✅ Legacy storage cleaned up');
  }
}
