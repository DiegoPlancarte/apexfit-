import { jest } from '@jest/globals';
import {
  openDB,
  queueSyncAction,
  getPendingSyncActions,
  markSyncActionDone,
  clearSyncOutbox,
  flushSyncOutbox,
  initSyncManager,
  saveSession,
  getSessions,
  getSessionById,
  deleteSession,
  saveShoe,
  getShoeRotation,
  saveAllShoes,
  saveBodyMetric,
  getBodyMetrics,
  exportBackupData,
  importBackupData,
  STORES,
} from '../src/services/db';

describe('IndexedDB Persistence & Offline Sync Outbox Queue', () => {
  beforeEach(async () => {
    // Clear outbox and collections before each test for clean test isolation
    await clearSyncOutbox();
    const db = await openDB();
    const tx = db.transaction([STORES.SESSIONS, STORES.SHOE_ROTATION, STORES.BODY_METRICS], 'readwrite');
    tx.objectStore(STORES.SESSIONS).clear();
    tx.objectStore(STORES.SHOE_ROTATION).clear();
    tx.objectStore(STORES.BODY_METRICS).clear();
    await new Promise((resolve) => {
      tx.oncomplete = resolve;
    });
  });

  describe('Sync Outbox Queue Lifecycle', () => {
    it('queues offline actions with synced: false and auto-incrementing ID', async () => {
      const id1 = await queueSyncAction('logWorkoutSession', {
        sessionId: 'sess_test_1',
        workoutName: 'Chest Day',
        durationSec: 2400,
      });

      const id2 = await queueSyncAction({
        action: 'logRunWorkout',
        payload: {
          sessionId: 'run_test_2',
          workoutName: 'Recovery 5K',
          distanceMiles: 3.1,
        },
      });

      expect(typeof id1).toBe('number');
      expect(typeof id2).toBe('number');
      expect(id2).toBeGreaterThan(id1);

      const pending = await getPendingSyncActions();
      expect(pending).toHaveLength(2);

      const item1 = pending.find((p) => p.id === id1);
      expect(item1).toBeDefined();
      expect(item1.action).toBe('logWorkoutSession');
      expect(item1.synced).toBe(false);
      expect(item1.payload.session.Workout_ID).toBe('sess_test_1');

      const item2 = pending.find((p) => p.id === id2);
      expect(item2).toBeDefined();
      expect(item2.action).toBe('logRunWorkout');
      expect(item2.synced).toBe(false);
      expect(item2.payload.session.Workout_ID).toBe('run_test_2');
    });

    it('marks an action as synced and deletes it when deleteCompleted=true', async () => {
      const id = await queueSyncAction('logWorkoutSession', {
        sessionId: 'sess_to_delete',
      });

      let pending = await getPendingSyncActions();
      expect(pending).toHaveLength(1);

      await markSyncActionDone(id, true);

      pending = await getPendingSyncActions();
      expect(pending).toHaveLength(0);
    });

    it('updates action to synced: true without deleting when deleteCompleted=false', async () => {
      const id = await queueSyncAction('logWorkoutSession', {
        sessionId: 'sess_to_flag',
      });

      await markSyncActionDone(id, false);

      // getPendingSyncActions filters out synced: true items
      const pending = await getPendingSyncActions();
      expect(pending).toHaveLength(0);

      // Verify the record itself still exists in outbox with synced: true
      const db = await openDB();
      const stored = await new Promise((resolve) => {
        const tx = db.transaction(STORES.SYNC_OUTBOX, 'readonly');
        const req = tx.objectStore(STORES.SYNC_OUTBOX).get(id);
        req.onsuccess = () => resolve(req.result);
      });

      expect(stored).toBeDefined();
      expect(stored.synced).toBe(true);
      expect(stored.syncedAt).toBeDefined();
    });

    it('clears all outbox actions', async () => {
      await queueSyncAction('action1', { data: 1 });
      await queueSyncAction('action2', { data: 2 });
      await queueSyncAction('action3', { data: 3 });

      expect(await getPendingSyncActions()).toHaveLength(3);

      await clearSyncOutbox();
      expect(await getPendingSyncActions()).toHaveLength(0);
    });
  });

  describe('Automatic Background Sync (flushSyncOutbox & initSyncManager)', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    });

    it('flushes pending outbox mutations automatically to backend endpoint', async () => {
      await queueSyncAction('logWorkoutSession', {
        sessionId: 'sess_auto_1',
        workoutName: 'Upper Body',
        durationSec: 1800,
        sets: [{ setNumber: 1, weightLbs: 200, reps: 10, rir: 2 }],
      });

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ status: 'ok' }),
      });
      global.fetch = mockFetch;

      const result = await flushSyncOutbox('https://script.google.com/macros/s/test/exec');

      expect(result.flushed).toBe(1);
      expect(result.remaining).toBe(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify post payload contained normalized snake_case schema
      const calledBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(calledBody.action).toBe('logWorkoutSession');
      expect(calledBody.session.Workout_ID).toBe('sess_auto_1');

      // Verify outbox queue is now empty
      const pendingAfter = await getPendingSyncActions();
      expect(pendingAfter).toHaveLength(0);
    });

    it('preserves outbox queue and skips sync when offline', async () => {
      await queueSyncAction('logWorkoutSession', { sessionId: 'sess_offline_1' });

      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      const mockFetch = jest.fn();
      global.fetch = mockFetch;

      const result = await flushSyncOutbox('https://script.google.com/macros/s/test/exec');

      expect(result.isOffline).toBe(true);
      expect(result.flushed).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();

      const pendingAfter = await getPendingSyncActions();
      expect(pendingAfter).toHaveLength(1);
    });

    it('handles server errors gracefully by keeping pending items in outbox', async () => {
      await queueSyncAction('logWorkoutSession', { sessionId: 'sess_err_1' });

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await flushSyncOutbox('https://script.google.com/macros/s/test/exec');

      expect(result.flushed).toBe(0);
      expect(result.remaining).toBe(1);

      const pendingAfter = await getPendingSyncActions();
      expect(pendingAfter).toHaveLength(1);
    });

    it('initSyncManager initializes network listener and returns cleanup function', () => {
      const onSyncMock = jest.fn();
      const cleanup = initSyncManager(onSyncMock);

      expect(typeof cleanup).toBe('function');
      cleanup();
    });
  });

  describe('Session Store CRUD Operations', () => {
    it('saves, retrieves by ID, lists, and deletes workout sessions', async () => {
      const session = {
        sessionId: 'sess_crud_100',
        workoutName: 'Leg Day Volume',
        date: '2026-11-04',
        type: 'workout',
        durationSec: 4200,
        exercises: [
          {
            exerciseName: 'Barbell Back Squat',
            sets: [{ weightLbs: 315, reps: 5, rir: 2, completed: true }],
          },
        ],
      };

      await saveSession(session);

      // Fetch by ID
      const fetched = await getSessionById('sess_crud_100');
      expect(fetched).toBeDefined();
      expect(fetched.sessionId).toBe('sess_crud_100');
      expect(fetched.workoutName).toBe('Leg Day Volume');

      // Fetch all sessions
      const allSessions = await getSessions();
      expect(allSessions.some((s) => s.sessionId === 'sess_crud_100')).toBe(true);

      // Delete session
      const deleteResult = await deleteSession('sess_crud_100');
      expect(deleteResult).toBe(true);

      const afterDelete = await getSessionById('sess_crud_100');
      expect(afterDelete).toBeNull();
    });

    it('filters sessions by date range', async () => {
      await saveSession({ sessionId: 's1', date: '2026-11-01', workoutName: 'Day 1' });
      await saveSession({ sessionId: 's2', date: '2026-11-03', workoutName: 'Day 3' });
      await saveSession({ sessionId: 's3', date: '2026-11-05', workoutName: 'Day 5' });

      const filtered = await getSessions({
        startDate: '2026-11-02',
        endDate: '2026-11-04',
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].sessionId).toBe('s2');
    });
  });

  describe('Shoe Rotation & Body Metrics Persistence', () => {
    it('saves and retrieves shoe rotation fleet', async () => {
      const shoes = [
        { id: 'shoe_1', name: 'Alphafly 3', currentMiles: 25, maxMiles: 250, isActive: true },
        { id: 'shoe_2', name: 'Pegasus 40', currentMiles: 150, maxMiles: 350, isActive: false },
      ];

      await saveAllShoes(shoes);
      const retrieved = await getShoeRotation();
      expect(retrieved).toHaveLength(2);
      expect(retrieved.find((s) => s.id === 'shoe_1').name).toBe('Alphafly 3');

      // Update single shoe
      await saveShoe({ id: 'shoe_1', name: 'Alphafly 3', currentMiles: 32, maxMiles: 250, isActive: true });
      const updated = await getShoeRotation();
      expect(updated.find((s) => s.id === 'shoe_1').currentMiles).toBe(32);
    });

    it('saves and retrieves body metrics', async () => {
      await saveBodyMetric({
        id: 'metric_test',
        date: '2026-11-04',
        weightLbs: 178.5,
        bodyFatPct: 14.7,
      });

      const metrics = await getBodyMetrics();
      const found = metrics.find((m) => m.id === 'metric_test');
      expect(found).toBeDefined();
      expect(found.weightLbs).toBe(178.5);
      expect(found.bodyFatPct).toBe(14.7);
    });
  });

  describe('Backup & Restore Pipeline', () => {
    it('exports all local stores and imports them back safely', async () => {
      await saveSession({ sessionId: 'sess_backup_test', workoutName: 'Upper Test' });
      await saveShoe({ id: 'shoe_backup_test', name: 'Test Runner', currentMiles: 10 });
      await saveBodyMetric({ id: 'metric_backup_test', weightLbs: 180 });

      const backup = await exportBackupData();
      expect(backup.app).toBe('apexfit-pwa');
      expect(backup.stores.sessions.some((s) => s.sessionId === 'sess_backup_test')).toBe(true);
      expect(backup.stores.shoe_rotation.some((s) => s.id === 'shoe_backup_test')).toBe(true);
      expect(backup.stores.body_metrics.some((m) => m.id === 'metric_backup_test')).toBe(true);

      // Clear all
      const db = await openDB();
      const tx = db.transaction([STORES.SESSIONS, STORES.SHOE_ROTATION, STORES.BODY_METRICS], 'readwrite');
      tx.objectStore(STORES.SESSIONS).clear();
      tx.objectStore(STORES.SHOE_ROTATION).clear();
      tx.objectStore(STORES.BODY_METRICS).clear();
      await new Promise((resolve) => {
        tx.oncomplete = resolve;
      });

      // Restore from backup
      const importResult = await importBackupData(backup);
      expect(importResult.success).toBe(true);
      expect(importResult.imported.sessions).toBeGreaterThanOrEqual(1);

      // Verify restored
      const restoredSession = await getSessionById('sess_backup_test');
      expect(restoredSession).toBeDefined();
      expect(restoredSession.workoutName).toBe('Upper Test');
    });
  });
});
