import { jest } from '@jest/globals';
import {
  openDB,
  clearSyncOutbox,
  getSessionById,
  getSessions,
  saveSession,
  saveAndSyncEditedSession,
  updateProgressiveOverloadFromSession,
  STORES,
} from '../src/services/db';
import {
  STORAGE_KEY_HISTORY_LOG,
  STORAGE_KEY_API_URL,
  DEFAULT_WEEKLY_PLAN,
  normalizeSessionRecord,
  groupSetsIntoExercises,
} from '../src/services/api';

describe('Editable Session Review & Synchronization', () => {
  let originalFetch;

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEY_API_URL, 'https://script.google.com/macros/s/test/exec');
    await clearSyncOutbox();
    const db = await openDB();
    const tx = db.transaction([STORES.SESSIONS, STORES.SYNC_OUTBOX], 'readwrite');
    tx.objectStore(STORES.SESSIONS).clear();
    tx.objectStore(STORES.SYNC_OUTBOX).clear();
    await new Promise((resolve) => {
      tx.oncomplete = resolve;
    });

    originalFetch = global.fetch;
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      })
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('saveAndSyncEditedSession Metric Recalculation', () => {
    it('accurately recalculates totalVolumeLbs, totalSets, and avgRir upon editing sets', async () => {
      const initialSession = {
        sessionId: 'sess_edit_test_1',
        date: '2026-11-04',
        workoutName: 'Upper Body Power',
        type: 'workout',
        Total_Duration_Min: 40,
        notes: 'Initial workout notes',
        exercises: [
          {
            exerciseName: 'Barbell Bench Press',
            sets: [
              { setNumber: 1, weightLbs: 200, reps: 5, rir: 2 }, // 1000
              { setNumber: 2, weightLbs: 200, reps: 5, rir: 1 }, // 1000
            ],
          },
          {
            exerciseName: 'Incline DB Press',
            sets: [
              { setNumber: 1, weightLbs: 80, reps: 10, rir: 1 }, // 800
            ],
          },
        ],
      };

      // User edits sets in session: increases weight and adds reps
      const editedDraft = {
        ...initialSession,
        Total_Duration_Min: 55,
        notes: 'Updated: hit a heavy PR on set 2!',
        exercises: [
          {
            exerciseName: 'Barbell Bench Press',
            sets: [
              { setNumber: 1, weightLbs: 225, reps: 5, rir: 2 }, // 225 * 5 = 1125
              { setNumber: 2, weightLbs: 225, reps: 6, rir: 0 }, // 225 * 6 = 1350
            ],
          },
          {
            exerciseName: 'Incline DB Press',
            sets: [
              { setNumber: 1, weightLbs: 85, reps: 10, rir: 1 }, // 85 * 10 = 850
              { setNumber: 2, weightLbs: 85, reps: 8, rir: 0 },  // 85 * 8 = 680
            ],
          },
        ],
      };

      // Expected volume = 1125 + 1350 + 850 + 680 = 4005 lbs
      // Total sets = 4
      // Avg RIR = (2 + 0 + 1 + 0) / 4 = 0.8
      const savedResult = await saveAndSyncEditedSession(editedDraft);

      expect(savedResult.Total_Volume_Lbs).toBe(4005);
      expect(savedResult.totalVolumeLbs).toBe(4005);
      expect(savedResult.Total_Sets).toBe(4);
      expect(savedResult.totalSets).toBe(4);
      expect(savedResult.avgRir).toBe(0.8);
      expect(savedResult.Total_Duration_Min).toBe(55);
      expect(savedResult.durationSec).toBe(3300);
      expect(savedResult.notes).toBe('Updated: hit a heavy PR on set 2!');
    });

    it('persists changes into IndexedDB and keeps localStorage log mirror synchronized', async () => {
      const session = {
        sessionId: 'sess_persist_1',
        date: '2026-11-03',
        workoutName: 'Leg Day Volume',
        type: 'workout',
        Total_Duration_Min: 50,
        exercises: [
          {
            exerciseName: 'Barbell Back Squat',
            sets: [
              { setNumber: 1, weightLbs: 275, reps: 5, rir: 2 },
              { setNumber: 2, weightLbs: 275, reps: 5, rir: 1 },
            ],
          },
        ],
      };

      await saveAndSyncEditedSession(session);

      // Verify IndexedDB record
      const dbRecord = await getSessionById('sess_persist_1');
      expect(dbRecord).not.toBeNull();
      expect(dbRecord.sessionId).toBe('sess_persist_1');
      expect(dbRecord.Total_Volume_Lbs).toBe(2750); // 275 * 5 * 2 = 2750

      // Verify localStorage mirror
      const cached = localStorage.getItem(STORAGE_KEY_HISTORY_LOG);
      expect(cached).not.toBeNull();
      const parsed = JSON.parse(cached);
      const foundInCache = parsed.find((s) => s.sessionId === 'sess_persist_1');
      expect(foundInCache).toBeDefined();
      expect(foundInCache.Total_Volume_Lbs).toBe(2750);
    });

    it('updates progressive overload reference history in localStorage', async () => {
      const session = {
        sessionId: 'sess_overload_1',
        date: '2026-11-04',
        workoutName: 'Pull Strength',
        exercises: [
          {
            exerciseName: 'Barbell Deadlift',
            sets: [
              { setNumber: 1, weightLbs: 315, reps: 5, rir: 2 },
              { setNumber: 2, weightLbs: 365, reps: 3, rir: 1 },
            ],
          },
          {
            exerciseName: 'Weighted Pull-Up',
            sets: [
              { setNumber: 1, weightLbs: 45, reps: 6, rir: 1 },
            ],
          },
        ],
      };

      updateProgressiveOverloadFromSession(session);

      const cached = localStorage.getItem('apexfit_overload_history');
      expect(cached).not.toBeNull();
      const history = JSON.parse(cached);

      expect(history['Barbell Deadlift']).toHaveLength(2);
      expect(history['Barbell Deadlift'][0]).toEqual({
        setNumber: 1,
        weightLbs: 315,
        reps: 5,
        rir: 2,
      });
      expect(history['Barbell Deadlift'][1]).toEqual({
        setNumber: 2,
        weightLbs: 365,
        reps: 3,
        rir: 1,
      });

      expect(history['Weighted Pull-Up']).toHaveLength(1);
      expect(history['Weighted Pull-Up'][0]).toEqual({
        setNumber: 1,
        weightLbs: 45,
        reps: 6,
        rir: 1,
      });
    });

    it('automatically queues a logWorkoutSession action in sync outbox with snake_case payload', async () => {
      const session = {
        sessionId: 'sess_outbox_test_1',
        date: '2026-11-04',
        workoutName: 'Chest & Triceps',
        type: 'workout',
        Total_Duration_Min: 45,
        exercises: [
          {
            exerciseName: 'Dumbbell Bench Press',
            sets: [
              { setNumber: 1, weightLbs: 75, reps: 10, rir: 2 },
              { setNumber: 2, weightLbs: 75, reps: 9, rir: 1 },
            ],
          },
        ],
      };

      await saveAndSyncEditedSession(session);

      // Verify that sync action was triggered
      expect(global.fetch).toHaveBeenCalled();
      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);

      // Verify snake_case canonical Google Sheets payload mapping
      expect(callBody.action).toBe('logWorkoutSession');
      expect(callBody.session.Workout_ID).toBe('sess_outbox_test_1');
      expect(callBody.session.Workout_Name).toBe('Chest & Triceps');
      expect(callBody.session.Total_Volume_Lbs).toBe(1425); // (75 * 10) + (75 * 9) = 750 + 675 = 1425
      expect(callBody.session.Total_Sets).toBe(2);

      // Verify flat sets array schema
      expect(callBody.sets).toHaveLength(2);
      expect(callBody.sets[0].Workout_ID).toBe('sess_outbox_test_1');
      expect(callBody.sets[0].Exercise).toBe('Dumbbell Bench Press');
      expect(callBody.sets[0].Weight_Lbs).toBe(75);
      expect(callBody.sets[0].Reps).toBe(10);
      expect(callBody.sets[0].RIR).toBe(2);
    });

    it('dispatches apexfit:session-updated (and ironlog backwards compatibility) custom event upon save', async () => {
      let eventPayload = null;
      let legacyPayload = null;
      const listener = (e) => {
        eventPayload = e.detail;
      };
      const legacyListener = (e) => {
        legacyPayload = e.detail;
      };
      window.addEventListener('apexfit:session-updated', listener);
      window.addEventListener('ironlog:session-updated', legacyListener);

      const session = {
        sessionId: 'sess_event_test_1',
        date: '2026-11-04',
        workoutName: 'Arm Day',
        exercises: [
          {
            exerciseName: 'Bicep Curl',
            sets: [{ setNumber: 1, weightLbs: 35, reps: 12, rir: 2 }],
          },
        ],
      };

      await saveAndSyncEditedSession(session);

      expect(eventPayload).not.toBeNull();
      expect(eventPayload.sessionId).toBe('sess_event_test_1');
      expect(eventPayload.workoutName).toBe('Arm Day');
      expect(eventPayload.Total_Volume_Lbs).toBe(420);

      expect(legacyPayload).not.toBeNull();
      expect(legacyPayload.sessionId).toBe('sess_event_test_1');

      window.removeEventListener('apexfit:session-updated', listener);
      window.removeEventListener('ironlog:session-updated', legacyListener);
    });

    it('rejects with error when passed an empty session object', async () => {
      await expect(saveAndSyncEditedSession(null)).rejects.toThrow(
        'Cannot save an empty session record.'
      );
    });
  });

  describe('Session Record Normalization & Data Mapping', () => {
    it('groups flat sets into structured exercises array', () => {
      const flatSets = [
        { Exercise: 'Barbell Bench Press', Set_Number: 1, Weight_Lbs: 185, Reps: 8, RIR: 2 },
        { Exercise: 'Barbell Bench Press', Set_Number: 2, Weight_Lbs: 185, Reps: 7, RIR: 1 },
        { Exercise: 'Lat Pulldown', Set_Number: 1, Weight_Lbs: 140, Reps: 10, RIR: 2 },
      ];

      const grouped = groupSetsIntoExercises(flatSets);
      expect(grouped).toHaveLength(2);
      expect(grouped[0].exerciseName).toBe('Barbell Bench Press');
      expect(grouped[0].sets).toHaveLength(2);
      expect(grouped[0].sets[0].weightLbs).toBe(185);
      expect(grouped[0].sets[0].reps).toBe(8);
      expect(grouped[0].sets[1].reps).toBe(7);

      expect(grouped[1].exerciseName).toBe('Lat Pulldown');
      expect(grouped[1].sets).toHaveLength(1);
      expect(grouped[1].sets[0].weightLbs).toBe(140);
    });

    it('populates exercises, volume, and sets without defaulting to zero when retrieved from IndexedDB', async () => {
      const completedSession = {
        sessionId: 'sess_mapping_test_1',
        date: '2026-11-04',
        workoutName: 'Upper Body Power',
        type: 'workout',
        day_index: 1,
        totalVolumeLbs: 3500,
        totalSets: 4,
        durationSec: 2700,
        exercises: [
          {
            exerciseName: 'Barbell Bench Press',
            sets: [
              { setNumber: 1, weightLbs: 225, reps: 5, rir: 2, completed: true },
              { setNumber: 2, weightLbs: 225, reps: 5, rir: 1, completed: true },
            ],
          },
          {
            exerciseName: 'Incline Dumbbell Press',
            sets: [
              { setNumber: 1, weightLbs: 70, reps: 9, rir: 1, completed: true },
              { setNumber: 2, weightLbs: 70, reps: 8, rir: 0, completed: true },
            ],
          },
        ],
      };

      await saveSession(completedSession);

      const retrieved = await getSessionById('sess_mapping_test_1');
      expect(retrieved).not.toBeNull();
      expect(retrieved.sessionId).toBe('sess_mapping_test_1');
      expect(retrieved.totalVolumeLbs).toBe(3500);
      expect(retrieved.totalSets).toBe(4);
      expect(retrieved.durationSec).toBe(2700);
      expect(retrieved.exercises).toHaveLength(2);
      expect(retrieved.exercises[0].exerciseName).toBe('Barbell Bench Press');
      expect(retrieved.exercises[0].sets).toHaveLength(2);
      expect(retrieved.exercises[1].exerciseName).toBe('Incline Dumbbell Press');
      expect(retrieved.exercises[1].sets).toHaveLength(2);

      const allSessions = await getSessions();
      const found = allSessions.find((s) => s.sessionId === 'sess_mapping_test_1');
      expect(found).toBeDefined();
      expect(found.totalVolumeLbs).toBe(3500);
      expect(found.exercises).toHaveLength(2);
    });

    it('normalizes legacy flat-set sessions missing exercises array', () => {
      const legacySession = {
        Workout_ID: 'sess_legacy_flat',
        Date: '2026-11-01',
        Workout_Name: 'Squat Day',
        Total_Duration_Min: 45,
        Total_Volume_Lbs: 4500,
        Total_Sets: 3,
        sets: [
          { Exercise: 'Barbell Back Squat', Set_Number: 1, Weight_Lbs: 300, Reps: 5, RIR: 2 },
          { Exercise: 'Barbell Back Squat', Set_Number: 2, Weight_Lbs: 300, Reps: 5, RIR: 1 },
          { Exercise: 'Barbell Back Squat', Set_Number: 3, Weight_Lbs: 300, Reps: 5, RIR: 0 },
        ],
      };

      const normalized = normalizeSessionRecord(legacySession);
      expect(normalized.sessionId).toBe('sess_legacy_flat');
      expect(normalized.totalVolumeLbs).toBe(4500);
      expect(normalized.totalSets).toBe(3);
      expect(normalized.exercises).toBeDefined();
      expect(normalized.exercises).toHaveLength(1);
      expect(normalized.exercises[0].exerciseName).toBe('Barbell Back Squat');
      expect(normalized.exercises[0].sets).toHaveLength(3);
      expect(normalized.exercises[0].sets[0].weightLbs).toBe(300);
    });
  });

  describe('Smart WOD Session Routing', () => {
    it('identifies scheduled lifting workouts vs runs and active recovery rest days', () => {
      const liftingDay1 = DEFAULT_WEEKLY_PLAN.find((d) => d.dayNumber === 1);
      expect(liftingDay1.activityType).toBe('workout');

      const runDay3 = DEFAULT_WEEKLY_PLAN.find((d) => d.dayNumber === 3);
      expect(runDay3.activityType).toBe('run');

      const restDay7 = DEFAULT_WEEKLY_PLAN.find((d) => d.dayNumber === 7);
      expect(restDay7.activityType).toBe('rest');
    });
  });
});
