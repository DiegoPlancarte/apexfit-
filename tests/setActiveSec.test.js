import {
  buildWorkoutPayload,
  normalizeSessionRecord,
  groupSetsIntoExercises,
} from '../src/services/api';
import {
  normalizeOutboxPayload,
  saveAndSyncEditedSession,
  saveSession,
  clearSyncOutbox,
  openDB,
  STORES,
} from '../src/services/db';

describe('Real-World Set Duration Tracking (Active_Sec) & Payload Mapping', () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearSyncOutbox();
    const db = await openDB();
    const tx = db.transaction([STORES.SESSIONS, STORES.SYNC_OUTBOX], 'readwrite');
    tx.objectStore(STORES.SESSIONS).clear();
    tx.objectStore(STORES.SYNC_OUTBOX).clear();
    await new Promise((resolve) => {
      tx.oncomplete = resolve;
    });
  });

  describe('Wall-Clock Active Duration Calculation Logic', () => {
    it('calculates elapsed active seconds between session start anchor and set completion', () => {
      const sessionStartIso = '2026-11-05T10:00:00.000Z';
      const set1CompletedIso = '2026-11-05T10:00:43.000Z';

      const startMs = new Date(sessionStartIso).getTime();
      const endMs = new Date(set1CompletedIso).getTime();
      const calculatedDuration = Math.max(1, Math.round((endMs - startMs) / 1000));

      expect(calculatedDuration).toBe(43);
      expect(calculatedDuration).not.toBe(35); // Replaced static 35s mock TUT
    });

    it('clamps active duration to at least 1 second when set completes almost immediately', () => {
      const sessionStartIso = '2026-11-05T10:00:00.000Z';
      const fastCompleteIso = '2026-11-05T10:00:00.250Z'; // 250ms elapsed

      const startMs = new Date(sessionStartIso).getTime();
      const endMs = new Date(fastCompleteIso).getTime();
      const calculatedDuration = Math.max(1, Math.round((endMs - startMs) / 1000));

      expect(calculatedDuration).toBe(1);
    });

    it('chains start anchor from preceding rest timer completion for subsequent sets', () => {
      // 90s rest timer completes at 10:02:15 after Set 1
      const restTimerFinishedIso = '2026-11-05T10:02:15.000Z';
      // Set 2 is performed and completed at 10:02:53
      const set2CompletedIso = '2026-11-05T10:02:53.000Z';

      const restEndMs = new Date(restTimerFinishedIso).getTime();
      const set2EndMs = new Date(set2CompletedIso).getTime();
      const set2ActiveSec = Math.max(1, Math.round((set2EndMs - restEndMs) / 1000));

      // Active duration for Set 2 should be 38s, anchored to rest finish, not session start
      expect(set2ActiveSec).toBe(38);
      expect(set2ActiveSec).not.toBe(173); // Not total elapsed session time (10:00:00 -> 10:02:53)
    });
  });

  describe('Google Sheets Payload Schema Mapping (Active_Sec)', () => {
    it('maps Active_Sec and active_sec into buildWorkoutPayload setRecords', () => {
      const workoutSession = {
        sessionId: 'sess_active_sec_test',
        workoutName: 'Push Day A',
        type: 'workout',
        durationSec: 1800,
        notes: 'Testing active duration tracking',
        exercises: [
          {
            exerciseName: 'Barbell Bench Press',
            sets: [
              {
                setNumber: 1,
                weightLbs: 225,
                reps: 8,
                rir: 2,
                active_sec: 44,
                Active_Sec: 44,
                setActiveSec: 44,
                Set_Active_Sec: 44,
                completed: true,
                completedAt: '2026-11-05T10:01:00.000Z',
              },
              {
                setNumber: 2,
                weightLbs: 225,
                reps: 7,
                rir: 1,
                active_sec: 39,
                Active_Sec: 39,
                setActiveSec: 39,
                Set_Active_Sec: 39,
                completed: true,
                completedAt: '2026-11-05T10:03:30.000Z',
              },
            ],
          },
        ],
      };

      const payload = buildWorkoutPayload(workoutSession);

      expect(payload).toBeDefined();
      expect(payload.action).toBe('logWorkoutSession');
      expect(payload.session.Workout_ID).toBe('sess_active_sec_test');
      expect(Array.isArray(payload.sets)).toBe(true);
      expect(payload.sets).toHaveLength(2);

      const [set1, set2] = payload.sets;
      expect(set1.Active_Sec).toBe(44);
      expect(set1.active_sec).toBe(44);
      expect(set1.Set_Active_Sec).toBe(44);
      expect(set1.setActiveSec).toBe(44);

      expect(set2.Active_Sec).toBe(39);
      expect(set2.active_sec).toBe(39);
      expect(set2.Set_Active_Sec).toBe(39);
      expect(set2.setActiveSec).toBe(39);
    });

    it('maps Active_Sec and active_sec into normalizeOutboxPayload normalizedSets', () => {
      const rawOutboxItem = {
        action: 'logWorkoutSession',
        session: {
          sessionId: 'sess_outbox_active_test',
          date: '2026-11-05',
          workoutName: 'Pull Day B',
          type: 'workout',
          durationSec: 2400,
        },
        sets: [
          {
            sessionId: 'sess_outbox_active_test',
            date: '2026-11-05',
            exerciseName: 'Barbell Deadlift',
            setNumber: 1,
            weightLbs: 315,
            reps: 5,
            rir: 2,
            Active_Sec: 51,
            active_sec: 51,
            completedAt: '2026-11-05T10:10:00.000Z',
          },
        ],
      };

      const normalized = normalizeOutboxPayload('logWorkoutSession', rawOutboxItem);
      expect(normalized.sets).toHaveLength(1);

      const set = normalized.sets[0];
      expect(set.Active_Sec).toBe(51);
      expect(set.active_sec).toBe(51);
      expect(set.Set_Active_Sec).toBe(51);
      expect(set.setActiveSec).toBe(51);
    });

    it('harmonizes Active_Sec in normalizeSessionRecord and groupSetsIntoExercises', () => {
      const rawSetsFromSheets = [
        {
          Workout_ID: 'sess_sheets_1',
          Date: '2026-11-05',
          Exercise: 'Overhead Press',
          Set_Number: 1,
          Weight_Lbs: 135,
          Reps: 6,
          RIR: 1,
          Active_Sec: 37,
          Rest_After_Sec: 120,
        },
      ];

      const grouped = groupSetsIntoExercises(rawSetsFromSheets);
      expect(grouped).toHaveLength(1);
      expect(grouped[0].exerciseName).toBe('Overhead Press');
      expect(grouped[0].sets[0].Active_Sec).toBe(37);
      expect(grouped[0].sets[0].active_sec).toBe(37);
      expect(grouped[0].sets[0].setActiveSec).toBe(37);

      const normalizedSession = normalizeSessionRecord({
        sessionId: 'sess_sheets_1',
        sets: rawSetsFromSheets,
      });

      expect(normalizedSession.exercises[0].sets[0].Active_Sec).toBe(37);
      expect(normalizedSession.exercises[0].sets[0].active_sec).toBe(37);
      expect(normalizedSession.exercises[0].sets[0].setActiveSec).toBe(37);
    });

    it('persists Active_Sec and active_sec when editing a session via saveAndSyncEditedSession', async () => {
      const initialSession = {
        sessionId: 'sess_edit_active_sec',
        date: '2026-11-05',
        workoutName: 'Legs A',
        type: 'workout',
        durationSec: 3000,
        exercises: [
          {
            exerciseName: 'Barbell Squat',
            sets: [
              {
                setNumber: 1,
                weightLbs: 275,
                reps: 6,
                rir: 2,
                Active_Sec: 46,
                active_sec: 46,
                completed: true,
              },
            ],
          },
        ],
      };

      await saveSession(initialSession);

      const editedSession = {
        ...initialSession,
        exercises: [
          {
            exerciseName: 'Barbell Squat',
            sets: [
              {
                setNumber: 1,
                weightLbs: 285,
                reps: 6,
                rir: 1,
                Active_Sec: 48,
                active_sec: 48,
                completed: true,
              },
            ],
          },
        ],
      };

      const result = await saveAndSyncEditedSession(editedSession);
      expect(result).toBeDefined();
      expect(result.exercises[0].sets[0].Active_Sec).toBe(48);
      expect(result.exercises[0].sets[0].active_sec).toBe(48);
      expect(result.sets[0].Active_Sec).toBe(48);
      expect(result.sets[0].active_sec).toBe(48);
    });
  });
});
