import { jest } from '@jest/globals';
import {
  initializeAppFlow,
  withTimeout,
  delay,
  DEFAULT_MIN_BRANDING_MS,
  DEFAULT_MAX_TIMEOUT_MS,
} from '../src/utils/appInit';
import {
  openDB,
  queueSyncAction,
  getPendingSyncActions,
  clearSyncOutbox,
  STORES,
} from '../src/services/db';

describe('App Initialization & Offline-First Resilient Fast-Boot Flow', () => {
  beforeEach(async () => {
    // Reset IndexedDB outbox and restore navigator.onLine to true before each test
    await clearSyncOutbox();
    const db = await openDB();
    const tx = db.transaction([STORES.SESSIONS, STORES.SHOE_ROTATION, STORES.BODY_METRICS], 'readwrite');
    tx.objectStore(STORES.SESSIONS).clear();
    tx.objectStore(STORES.SHOE_ROTATION).clear();
    tx.objectStore(STORES.BODY_METRICS).clear();
    await new Promise((resolve) => {
      tx.oncomplete = resolve;
    });

    if (typeof global.navigator !== 'undefined') {
      global.navigator.onLine = true;
    }
  });

  let hangingTimer;

  afterEach(() => {
    if (hangingTimer) clearTimeout(hangingTimer);
    if (typeof global.navigator !== 'undefined') {
      global.navigator.onLine = true;
    }
  });

  describe('withTimeout Helper', () => {
    it('resolves with the promise result when resolved within timeout window', async () => {
      const fastPromise = delay(20).then(() => 'success');
      const { result, timedOut } = await withTimeout(fastPromise, 100, 'fallback');

      expect(timedOut).toBe(false);
      expect(result).toBe('success');
    });

    it('returns fallback value and timedOut: true when duration exceeds timeout limit', async () => {
      const slowPromise = delay(150).then(() => 'slow-data');
      const { result, timedOut } = await withTimeout(slowPromise, 30, 'fallback-hit');

      expect(timedOut).toBe(true);
      expect(result).toBe('fallback-hit');
    });
  });

  describe('Offline Fast-Boot Scenarios', () => {
    it('boots immediately from local cache and dismisses without waiting for max network timeout when offline', async () => {
      global.navigator.onLine = false;

      // Queue an action to verify outbox persistence
      await queueSyncAction('logWorkoutSession', {
        sessionId: 'offline_sess_1',
        workoutName: 'Offline Deadlift Day',
      });

      const statusMessages = [];
      const startTime = Date.now();

      const result = await initializeAppFlow({
        minBrandingMs: 50,
        maxTimeoutMs: 500,
        onStatusUpdate: (msg) => statusMessages.push(msg),
      });

      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.isOffline).toBe(true);
      expect(result.timedOut).toBe(false);
      expect(result.flushed).toBe(0);
      expect(result.remaining).toBe(1);

      // Verify it adhered to min branding pacing (~50ms) and did NOT wait for maxTimeoutMs (500ms)
      expect(elapsed).toBeGreaterThanOrEqual(40);
      expect(elapsed).toBeLessThan(400);

      // Verify status messaging reflects offline status
      expect(statusMessages).toContain('INITIALIZING APEXFIT • HYDRATING LOCAL DATA');
      expect(statusMessages).toContain('OFFLINE MODE • LOCAL DATA READY');

      // Verify pending outbox action was preserved for later sync
      const pending = await getPendingSyncActions();
      expect(pending).toHaveLength(1);
      expect(pending[0].payload.session.sessionId).toBe('offline_sess_1');
    });
  });

  describe('Online Background Sync & Network Timeout Safeguards', () => {
    it('completes smoothly within branding duration when sync resolves quickly', async () => {
      global.navigator.onLine = true;

      const mockSyncFn = jest.fn().mockResolvedValue({
        flushed: 3,
        remaining: 0,
      });

      const statusMessages = [];
      const startTime = Date.now();

      const result = await initializeAppFlow({
        minBrandingMs: 60,
        maxTimeoutMs: 400,
        syncFn: mockSyncFn,
        onStatusUpdate: (msg) => statusMessages.push(msg),
      });

      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.isOffline).toBe(false);
      expect(result.timedOut).toBe(false);
      expect(result.flushed).toBe(3);
      expect(mockSyncFn).toHaveBeenCalledTimes(1);

      expect(elapsed).toBeGreaterThanOrEqual(50);
      expect(elapsed).toBeLessThan(350);

      expect(statusMessages).toContain('SYNC COMPLETE • 3 MUTATION(S) RECORDED');
    });

    it('enforces strict timeout safeguard on slow/hanging sync, dismissing splash and keeping outbox intact', async () => {
      global.navigator.onLine = true;

      // Queue an item to confirm it stays in outbox when sync times out
      await queueSyncAction('logWorkoutSession', {
        sessionId: 'hanging_sess_2',
        workoutName: 'Heavy Bench Press',
      });

      // Mock a network call that hangs beyond timeout threshold
      const hangingSyncFn = () =>
        new Promise((resolve) => {
          hangingTimer = setTimeout(() => {
            resolve({ flushed: 1, remaining: 0 });
          }, 600);
        });

      const statusMessages = [];
      const startTime = Date.now();

      const result = await initializeAppFlow({
        minBrandingMs: 40,
        maxTimeoutMs: 120, // Strict timeout safeguard
        syncFn: hangingSyncFn,
        onStatusUpdate: (msg) => statusMessages.push(msg),
      });

      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.isOffline).toBe(false);
      expect(result.timedOut).toBe(true);

      // Verify it dismissed at the timeout threshold (~120ms) rather than waiting for 600ms
      expect(elapsed).toBeGreaterThanOrEqual(100);
      expect(elapsed).toBeLessThan(450);

      expect(statusMessages).toContain('APEXFIT READY • SYNC RUNNING IN BACKGROUND');

      // Verify the mutation was NOT lost and remains queued in IndexedDB
      const pending = await getPendingSyncActions();
      expect(pending).toHaveLength(1);
      expect(pending[0].payload.session.sessionId).toBe('hanging_sess_2');
    });

    it('recovers gracefully and dismisses without throwing if seedFn or syncFn rejects', async () => {
      const failingSeedFn = () => Promise.reject(new Error('IndexedDB Disk Quota'));
      const failingSyncFn = () => Promise.reject(new Error('Network Endpoint Offline'));

      const statusMessages = [];
      const result = await initializeAppFlow({
        minBrandingMs: 30,
        maxTimeoutMs: 100,
        seedFn: failingSeedFn,
        syncFn: failingSyncFn,
        onStatusUpdate: (msg) => statusMessages.push(msg),
      });

      expect(result.success).toBe(true);
      expect(result.timedOut).toBe(false);
    });
  });

  describe('Default Timing Constants', () => {
    it('exports expected branding pacing and maximum timeout defaults', () => {
      expect(DEFAULT_MIN_BRANDING_MS).toBe(1200);
      expect(DEFAULT_MAX_TIMEOUT_MS).toBe(3500);
    });
  });
});
