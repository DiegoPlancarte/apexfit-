import { jest } from '@jest/globals';
import {
  ensureDatabaseSeeded,
  getSessions,
  clearSyncOutbox,
  openDB,
  STORES,
  saveSession,
} from '../src/services/db';
import {
  DEFAULT_HISTORICAL_SESSIONS,
  DEFAULT_WEEKLY_PLAN,
  fetchWeeklyPlan,
  updatePlanDayStatus,
} from '../src/services/api';

describe('Clean Database Initialization & Dynamic Starter Workout Handling', () => {
  beforeEach(async () => {
    // Clear outbox, localStorage, and IndexedDB collections for clean environment
    localStorage.clear();
    await clearSyncOutbox();
    const db = await openDB();
    const tx = db.transaction(
      [STORES.SESSIONS, STORES.SHOE_ROTATION, STORES.BODY_METRICS],
      'readwrite'
    );
    tx.objectStore(STORES.SESSIONS).clear();
    tx.objectStore(STORES.SHOE_ROTATION).clear();
    tx.objectStore(STORES.BODY_METRICS).clear();
    await new Promise((resolve) => {
      tx.oncomplete = resolve;
    });
  });

  describe('Clean Database State (Purged Mock/Dummy History Records)', () => {
    it('ensures DEFAULT_HISTORICAL_SESSIONS is empty with zero dummy records', () => {
      expect(DEFAULT_HISTORICAL_SESSIONS).toEqual([]);
      expect(DEFAULT_HISTORICAL_SESSIONS).toHaveLength(0);
    });

    it('initializes fresh IndexedDB with zero sessions and zero dummy archive items', async () => {
      // Run database seeding on fresh launch
      await ensureDatabaseSeeded();

      // Retrieve all sessions from IndexedDB
      const sessions = await getSessions();

      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions).toHaveLength(0);
    });
  });

  describe('Dynamic Starter Workout Plan', () => {
    it('provides a pre-made 7-day starter plan template with clean baseline metrics', () => {
      expect(Array.isArray(DEFAULT_WEEKLY_PLAN)).toBe(true);
      expect(DEFAULT_WEEKLY_PLAN).toHaveLength(7);

      // Verify each day contains valid plan structure
      DEFAULT_WEEKLY_PLAN.forEach((day, index) => {
        expect(day.dayNumber).toBe(index + 1);
        expect(day.title).toBeTruthy();
        expect(day.status).toBe('Scheduled');
        // Ensure no dummy/hardcoded PR or past performance strings are baked in
        expect(day.perfMetric).toBe('');
      });

      // Verify lifting days have target exercise suggestions
      const liftingDay = DEFAULT_WEEKLY_PLAN.find((d) => d.activityType === 'workout');
      expect(liftingDay).toBeDefined();
      expect(Array.isArray(liftingDay.targetExercises)).toBe(true);
      expect(liftingDay.targetExercises.length).toBeGreaterThan(0);
    });

    it('dynamically overrides starter plan when remote plan is fetched from Google Sheets', async () => {
      const customRemotePlan = [
        {
          dayNumber: 1,
          dayName: 'Monday',
          title: 'Custom Heavy Pull & Core',
          activityType: 'workout',
          badgeLabel: 'Pull Focus',
          description: 'Weighted Pull-Ups & Deadlifts',
          targetExercises: ['Barbell Deadlift', 'Pull-Up'],
          status: 'Scheduled',
          perfMetric: '',
        },
      ];

      // Mock remote fetch returning custom plan
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => JSON.stringify({ plan: customRemotePlan }),
      });

      // Set valid URL so fetch is triggered
      const fetchedPlan = await fetchWeeklyPlan('https://script.google.com/macros/s/test/exec');

      expect(fetchedPlan).toEqual(customRemotePlan);
      expect(fetchedPlan[0].title).toBe('Custom Heavy Pull & Core');
    });

    it('dynamically records real completed sessions and overrides template baseline without conflict', async () => {
      // 1. Database is initially clean
      await ensureDatabaseSeeded();
      expect(await getSessions()).toHaveLength(0);

      // 2. User logs a real workout session
      const realSession = {
        sessionId: 'sess_real_user_1',
        workoutName: 'Upper Body Hypertrophy',
        date: '2026-11-05',
        type: 'workout',
        durationSec: 2700,
        planDayNumber: 1,
        totalVolumeLbs: 16500,
        totalSets: 12,
        exercises: [
          {
            exerciseName: 'Barbell Bench Press',
            sets: [
              { setNumber: 1, weightLbs: 205, reps: 6, rir: 1, completed: true },
            ],
          },
        ],
      };

      await saveSession(realSession);

      // 3. Verify user's session is now stored and retrievable as real history
      const updatedSessions = await getSessions();
      expect(updatedSessions).toHaveLength(1);
      expect(updatedSessions[0].sessionId).toBe('sess_real_user_1');
      expect(updatedSessions[0].totalVolumeLbs).toBe(16500);

      // 4. Update plan day status cleanly
      global.fetch = jest.fn().mockResolvedValue({ ok: true, text: () => '{"status":"ok"}' });
      await expect(
        updatePlanDayStatus(1, 'Completed', 'https://script.google.com/macros/s/test/exec')
      ).resolves.not.toThrow();
    });
  });
});
