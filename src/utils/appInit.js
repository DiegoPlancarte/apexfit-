/**
 * ApexFit Fast-Boot & Offline-First App Initialization Coordinator
 *
 * Implements resilient startup orchestration:
 * 1. Instant local IndexedDB state hydration (ApexFitDB) for zero-latency offline use.
 * 2. Visual branding pacing guarantee (minimum display duration).
 * 3. Non-blocking Google Sheets sync with navigator.onLine check and strict timeout safeguards.
 * 4. Automatic splash screen dismissal without requiring manual user interaction.
 */

import {
  ensureDatabaseSeeded,
  flushSyncOutbox,
  getPendingSyncActions,
} from '../services/db';
import { pullLatestBackendData } from '../services/api';

export const DEFAULT_MIN_BRANDING_MS = 1200;
export const DEFAULT_MAX_TIMEOUT_MS = 3500;

/**
 * Creates a promise that resolves after a specified duration in milliseconds.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
export const delay = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Executes a promise with an enforced maximum timeout.
 *
 * @template T
 * @param {Promise<T>} promise
 * @param {number} timeoutMs
 * @param {T} fallbackValue
 * @returns {Promise<{ result: T, timedOut: boolean }>}
 */
export const withTimeout = async (promise, timeoutMs, fallbackValue = null) => {
  let timerId;
  const timeoutPromise = new Promise((resolve) => {
    timerId = setTimeout(() => {
      resolve({ result: fallbackValue, timedOut: true });
    }, timeoutMs);
  });

  try {
    const res = await Promise.race([
      promise.then((val) => ({ result: val, timedOut: false })),
      timeoutPromise,
    ]);
    return res;
  } finally {
    clearTimeout(timerId);
  }
};

/**
 * Coordinates the full-screen splash startup sequence and offline-first initialization:
 * 1. Immediate local IndexedDB state hydration (ApexFitDB seeded and ready for offline use).
 * 2. Visual pacing guarantee (minimum branding display duration).
 * 3. Non-blocking Google Sheets sync with navigator.onLine check and strict timeout safeguard.
 *
 * @param {Object} [options]
 * @param {number} [options.minBrandingMs=1200] - Minimum visual display duration for splash pacing
 * @param {number} [options.maxTimeoutMs=3500]  - Hard ceiling for network sync before proceeding offline
 * @param {Function} [options.onStatusUpdate]   - Status update callback for progress text
 * @param {Function} [options.seedFn]           - Optional override for database seeding
 * @param {Function} [options.syncFn]           - Optional override for sync flush
 * @returns {Promise<{ success: boolean, isOffline: boolean, timedOut: boolean, flushed: number, remaining: number }>}
 */
export async function initializeAppFlow(options = {}) {
  const {
    minBrandingMs = DEFAULT_MIN_BRANDING_MS,
    maxTimeoutMs = DEFAULT_MAX_TIMEOUT_MS,
    onStatusUpdate,
    seedFn = ensureDatabaseSeeded,
    syncFn = flushSyncOutbox,
    pullFn = pullLatestBackendData,
  } = options;

  // 1. Visual branding pacing timer
  const pacingPromise = delay(minBrandingMs);

  // 2. Hydrate local state from IndexedDB immediately (instant offline availability)
  onStatusUpdate?.('INITIALIZING APEXFIT • HYDRATING LOCAL DATA');
  try {
    await seedFn();
  } catch (err) {
    console.warn('Local database initialization warning:', err);
  }

  // 3. Inspect network connectivity status
  const isOnline =
    typeof navigator !== 'undefined' ? Boolean(navigator.onLine) : true;

  if (!isOnline) {
    onStatusUpdate?.('OFFLINE MODE • LOCAL DATA READY');
    await pacingPromise;
    const pending = await getPendingSyncActions().catch(() => []);
    return {
      success: true,
      isOffline: true,
      timedOut: false,
      flushed: 0,
      remaining: pending.length,
    };
  }

  // 4. Online: Initiate non-blocking background sync with strict timeout safeguard
  onStatusUpdate?.('SYNCING WITH GOOGLE SHEETS...');

  const syncPromise = Promise.resolve()
    .then(async () => {
      const flushRes = await syncFn().catch((err) => {
        console.warn('Sync flush error:', err);
        return { flushed: 0, remaining: 0, error: err };
      });

      // Condition (a): Initial PWA boot / startup sync pull
      let pullRes = null;
      try {
        if (typeof pullFn === 'function') {
          pullRes = await pullFn();
        }
      } catch (pullErr) {
        console.warn('Initial backend pull error:', pullErr);
      }

      return {
        flushed: flushRes?.flushed || 0,
        remaining: flushRes?.remaining || 0,
        pulled: Boolean(pullRes),
      };
    })
    .catch((err) => {
      console.warn('Background sync attempt error:', err);
      return { flushed: 0, remaining: 0, error: err };
    });

  // Calculate timeout window
  const syncTimeoutLimit = Math.max(minBrandingMs, maxTimeoutMs);

  // Race the combination of (min pacing + sync) against hard max timeout
  const outcome = await Promise.race([
    Promise.all([pacingPromise, syncPromise]).then(([, res]) => ({
      timedOut: false,
      res,
    })),
    delay(syncTimeoutLimit).then(() => ({
      timedOut: true,
      res: { flushed: 0, remaining: 0 },
    })),
  ]);

  const timedOut = outcome.timedOut;
  const syncResult = outcome.res || { flushed: 0, remaining: 0 };

  if (timedOut) {
    onStatusUpdate?.('APEXFIT READY • SYNC RUNNING IN BACKGROUND');
  } else if (syncResult?.flushed > 0) {
    onStatusUpdate?.(
      `SYNC COMPLETE • ${syncResult.flushed} MUTATION(S) RECORDED`
    );
  } else {
    onStatusUpdate?.('APEXFIT READY • LOCAL DATA SYNCHRONIZED');
  }

  const pending = await getPendingSyncActions().catch(() => []);

  return {
    success: true,
    isOffline: false,
    timedOut,
    flushed: syncResult?.flushed || 0,
    remaining: pending.length,
  };
}
