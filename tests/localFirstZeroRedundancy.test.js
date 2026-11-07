import { jest } from '@jest/globals';
import {
  fetchHistoricalSessions,
  fetchWeeklyPlan,
  pullLatestBackendData,
  STORAGE_KEY_API_URL,
  STORAGE_KEY_PLAN,
  STORAGE_KEY_HISTORY_LOG,
} from '../src/services/api';
import {
  openDB,
  saveSession,
  clearSyncOutbox,
  STORES,
} from '../src/services/db';
import { initializeAppFlow } from '../src/utils/appInit';

describe('Local-First, Zero-Redundancy Network Policy', () => {
  const TEST_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyFakeEndpoint/exec';
  let originalFetch;

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEY_API_URL, TEST_ENDPOINT);

    // Clear IndexedDB stores
    await clearSyncOutbox();
    const db = await openDB();
    const tx = db.transaction([STORES.SESSIONS, STORES.BODY_METRICS, STORES.SHOE_ROTATION], 'readwrite');
    tx.objectStore(STORES.SESSIONS).clear();
    tx.objectStore(STORES.BODY_METRICS).clear();
    tx.objectStore(STORES.SHOE_ROTATION).clear();
    await new Promise((resolve) => {
      tx.oncomplete = resolve;
    });

    originalFetch = global.fetch;
    if (typeof global.navigator !== 'undefined') {
      global.navigator.onLine = true;
    }
  });

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
  });

  describe('1. Archive Navigation & Local-First Read (Zero Network Calls)', () => {
    it('reads strictly from local IndexedDB with zero network requests when local records exist', async () => {
      // Seed a local session directly into IndexedDB
      await saveSession({
        sessionId: 'local_sess_101',
        Workout_ID: 'local_sess_101',
        date: '2026-11-04',
        Date: '2026-11-04',
        type: 'workout',
        Workout_Type: 'Strength',
        workoutName: 'Heavy Bench Day',
        Total_Duration_Min: 45,
        totalVolumeLbs: 12500,
        sets: [
          { exerciseName: 'Bench Press', weightLbs: 225, reps: 5, rir: 2, completed: true },
        ],
      });

      const fetchSpy = jest.fn();
      global.fetch = fetchSpy;

      // Routine archive navigation / query
      const sessions = await fetchHistoricalSessions({
        startDate: '2026-11-02',
        endDate: '2026-11-08',
        forceNetwork: false,
      });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionId).toBe('local_sess_101');
    });

    it('does not hit the network when switching weeks even if that specific week has 0 workouts, as long as local DB has records', async () => {
      // Seed a session in a different week
      await saveSession({
        sessionId: 'local_sess_prev_week',
        Workout_ID: 'local_sess_prev_week',
        date: '2026-10-20',
        Date: '2026-10-20',
        type: 'workout',
        workoutName: 'Squat Day',
      });

      const fetchSpy = jest.fn();
      global.fetch = fetchSpy;

      // Query a week with no workouts (e.g. November week)
      const sessions = await fetchHistoricalSessions({
        startDate: '2026-11-09',
        endDate: '2026-11-15',
        forceNetwork: false,
      });

      // Crucial: 0 network requests! Empty week shouldn't cause redundant GET calls
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(sessions).toEqual([]);
    });

    it('reads weekly plan strictly from local cache with zero network requests', async () => {
      const cachedPlan = [
        {
          dayNumber: 1,
          dayName: 'Monday',
          title: 'Custom Cached Chest',
          activityType: 'workout',
          status: 'Scheduled',
        },
      ];
      localStorage.setItem(STORAGE_KEY_PLAN, JSON.stringify(cachedPlan));

      const fetchSpy = jest.fn();
      global.fetch = fetchSpy;

      const plan = await fetchWeeklyPlan({ forceNetwork: false });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(plan).toHaveLength(1);
      expect(plan[0].title).toBe('Custom Cached Chest');
    });
  });

  describe('2. Authorized Network Sync Triggers (Conditions a, b, c, d)', () => {
    it('Condition (a): triggers initial sync pull during PWA app startup boot', async () => {
      const mockPullFn = jest.fn().mockResolvedValue({
        plan: [{ dayNumber: 1, title: 'Boot Plan' }],
        sessions: [{ sessionId: 'boot_sess_1' }],
      });
      const mockSyncFn = jest.fn().mockResolvedValue({ flushed: 0, remaining: 0 });

      const res = await initializeAppFlow({
        minBrandingMs: 30,
        maxTimeoutMs: 300,
        syncFn: mockSyncFn,
        pullFn: mockPullFn,
      });

      expect(res.success).toBe(true);
      expect(mockSyncFn).toHaveBeenCalledTimes(1);
      expect(mockPullFn).toHaveBeenCalledTimes(1);
    });

    it('Condition (c): on-demand user action triggers network fetch when forceNetwork is true', async () => {
      // Seed existing local record
      await saveSession({
        sessionId: 'local_sess_1',
        date: '2026-11-04',
        workoutName: 'Old Local Workout',
      });

      const remoteData = {
        status: 'ok',
        data: {
          sessions: [
            {
              Workout_ID: 'remote_sess_99',
              Date: '2026-11-04',
              Workout_Name: 'Fresh Cloud Pull',
              Workout_Type: 'Strength',
            },
          ],
          sets: [],
        },
      };

      const fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(remoteData),
      });
      global.fetch = fetchSpy;

      // On-demand refresh with forceNetwork: true
      const result = await fetchHistoricalSessions({
        startDate: '2026-11-02',
        endDate: '2026-11-08',
        forceNetwork: true,
      });

      expect(fetchSpy).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].sessionId).toBe('remote_sess_99');
    });

    it('Condition (d): automated fallback occurs ONLY if local IndexedDB lacks records entirely', async () => {
      // IndexedDB has 0 sessions currently
      const remoteData = {
        status: 'ok',
        data: {
          sessions: [
            {
              Workout_ID: 'fallback_sess_1',
              Date: '2026-11-05',
              Workout_Name: 'Remote First Hydration',
              Workout_Type: 'Run',
              Distance_Miles: 4.2,
            },
          ],
          sets: [],
        },
      };

      const fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(remoteData),
      });
      global.fetch = fetchSpy;

      // First query when local DB is empty: triggers Condition (d) fallback
      const sessions = await fetchHistoricalSessions({
        startDate: '2026-11-02',
        endDate: '2026-11-08',
        forceNetwork: false,
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionId).toBe('fallback_sess_1');

      // Now that it has been ingested into IndexedDB, subsequent navigation makes 0 network calls!
      fetchSpy.mockClear();

      const cachedSessions = await fetchHistoricalSessions({
        startDate: '2026-11-02',
        endDate: '2026-11-08',
        forceNetwork: false,
      });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(cachedSessions).toHaveLength(1);
      expect(cachedSessions[0].sessionId).toBe('fallback_sess_1');
    });
  });

  describe('3. Persistence & Cache Check', () => {
    it('pullLatestBackendData ingests remote bundle into IndexedDB and localStorage so future queries are 100% local', async () => {
      const backendPayload = {
        status: 'ok',
        data: {
          plan: [
            {
              Day_Number: 1,
              Day_Name: 'Monday',
              Workout_Title: 'Incline Bench & Arms',
              Activity_Type: 'Lifting',
            },
          ],
          dailySummary: [
            {
              Date: '2026-11-04',
              Total_Steps: 11250,
            },
          ],
          sessions: [
            {
              Workout_ID: 'bundle_sess_10',
              Date: '2026-11-04',
              Workout_Name: 'Incline Press Session',
              Workout_Type: 'Lifting',
              Total_Duration_Min: 55,
            },
          ],
          sets: [
            {
              Workout_ID: 'bundle_sess_10',
              Exercise_Name: 'Incline DB Press',
              Set_Number: 1,
              Weight_Lbs: 80,
              Reps: 10,
              RIR: 2,
            },
          ],
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(backendPayload),
      });

      // 1. Initial boot pull
      const ingested = await pullLatestBackendData();
      expect(ingested).not.toBeNull();
      expect(ingested.sessions).toHaveLength(1);
      expect(ingested.plan).toHaveLength(1);

      // Verify localStorage was updated
      const storedPlan = JSON.parse(localStorage.getItem(STORAGE_KEY_PLAN));
      expect(storedPlan[0].title).toBe('Incline Bench & Arms');

      const storedHistory = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY_LOG));
      expect(storedHistory[0].sessionId).toBe('bundle_sess_10');

      // 2. Clear network mock to ensure subsequent reads NEVER touch the network
      global.fetch = jest.fn().mockImplementation(() => {
        throw new Error('Unexpected network call during routine navigation!');
      });

      // Plan read is 100% local
      const planLocal = await fetchWeeklyPlan({ forceNetwork: false });
      expect(planLocal[0].title).toBe('Incline Bench & Arms');

      // History read is 100% local
      const sessionsLocal = await fetchHistoricalSessions({
        startDate: '2026-11-02',
        endDate: '2026-11-08',
        forceNetwork: false,
      });
      expect(sessionsLocal).toHaveLength(1);
      expect(sessionsLocal[0].sessionId).toBe('bundle_sess_10');
      expect(sessionsLocal[0].exercises[0].exerciseName).toBe('Incline DB Press');
    });
  });
});
