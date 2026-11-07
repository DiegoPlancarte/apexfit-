import {
  unwrapBackendPayload,
  normalizePlanItem,
  normalizeWeeklyPlan,
  ingestDailySummaries,
  joinSessionsAndSets,
  normalizeSessionRecord,
  ingestBackendSyncBundle,
  STORAGE_KEY_PLAN,
  STORAGE_KEY_STEPS,
  STORAGE_KEY_HISTORY_LOG,
} from '../src/services/api';
import {
  openDB,
  STORES,
  clearSyncOutbox,
  getSessions,
} from '../src/services/db';

// Exact sample payload from user's backend response
const SAMPLE_BACKEND_PAYLOAD = {
  status: 'ok',
  data: {
    plan: [
      {
        Day_Number: 1,
        Date: '2026-11-09',
        Day_Label: 'Monday',
        Activity_Type: 'Lifting',
        Category_Badge: 'Lower Body',
        Workout_Title: 'Lower Body + Core',
        Description: 'Focus on knee tracking and glute activation. Completely hands-free or light dumbbell hold against chest. Keep elbow strain at zero.',
        Exercises_JSON: '[{"exercise":"Goblet Squat","target_sets":3,"target_reps":"10-12","target_rir":3,"rest_sec":90},{"exercise":"Romanian Deadlift (Dumbbell)","target_sets":3,"target_reps":"10-12","target_rir":3,"rest_sec":90},{"exercise":"Walking Lunges","target_sets":3,"target_reps":"10/leg","target_rir":3,"rest_sec":75},{"exercise":"Standing Calf Raises","target_sets":3,"target_reps":"15","target_rir":2,"rest_sec":60},{"exercise":"Deadbugs","target_sets":3,"target_reps":"45s hold","target_rir":2,"rest_sec":60}]',
        Status: 'Scheduled',
        Completed_Workout_ID: '',
      },
      {
        Day_Number: 2,
        Date: '2026-11-10',
        Day_Label: 'Tuesday',
        Activity_Type: 'Running',
        Category_Badge: 'Base Run',
        Workout_Title: 'Midweek Easy Run',
        Description: '2.5–3.0 miles. Maintain strict Zone 2 / conversational pace (talk test). Relax arms at 90 degrees with loose hands.',
        Exercises_JSON: '[{"exercise":"Outdoor / Treadmill Run","target_distance_mi":2.75,"pace_target":"Conversational (Zone 2)","notes":"Keep cadence at 170-180 spm"}]',
        Status: 'Scheduled',
        Completed_Workout_ID: '',
      },
      {
        Day_Number: 7,
        Date: '2026-11-15',
        Day_Label: 'Sunday',
        Activity_Type: 'Rest',
        Category_Badge: 'Recovery',
        Workout_Title: 'Active Recovery & Mobility',
        Description: 'Full rest day. Systemic recovery, gentle hip and ankle mobility, light unweighted walking, and hydration.',
        Exercises_JSON: '[{"exercise":"Light Walk & Mobility","target_duration_min":20,"notes":"No heavy loading or running"}]',
        Status: 'Scheduled',
        Completed_Workout_ID: '',
      },
    ],
    dailySummary: [
      {
        Date: '2026-10-26',
        Steps: 4885,
        Step_Goal_Met: false,
        Distance_Miles: 2.2,
        Total_Calories: 2451,
        Active_Calories: 315,
        Active_Zone_Min: '',
        Resting_HR: 59,
        Last_Updated: '20:20',
      },
      {
        Date: '2026-10-27',
        Steps: 11016,
        Step_Goal_Met: true,
        Distance_Miles: 4.91,
        Total_Calories: 2670,
        Active_Calories: 657,
        Active_Zone_Min: '',
        Resting_HR: 58,
        Last_Updated: '20:20',
      },
      {
        Date: '2026-11-06',
        Steps: 4512,
        Step_Goal_Met: false,
        Distance_Miles: 2.71,
        Total_Calories: 1452,
        Active_Calories: 526,
        Active_Zone_Min: 59,
        Resting_HR: '',
        Last_Updated: '10:40',
      },
    ],
    sessions: [
      {
        Workout_ID: '7048769566620476000',
        Date: '2026-10-31',
        Start_Time: '16:34',
        End_Time: '17:04',
        Workout_Type: 'Walk',
        Total_Duration_Min: 30.8,
        Active_Lift_Min: '',
        Total_Rest_Min: '',
        Avg_HR: 81,
        Max_HR: '',
        HR_Zones: '',
        Calories: 181,
        Distance_Miles: 0.8,
        Active_Zone_Min: '',
        Lifting_Summary: '',
        Raw_Source: 'Pixel Watch / Google Health',
        Splits: 'Avg Pace: 38:30 /mi',
      },
      {
        Workout_ID: '4201089046014862530',
        Date: '2026-10-28',
        Start_Time: '19:43',
        End_Time: '20:47',
        Workout_Type: 'Treadmill run',
        Total_Duration_Min: 63.8,
        Active_Lift_Min: '',
        Total_Rest_Min: '',
        Avg_HR: 83,
        Max_HR: '',
        HR_Zones: '',
        Calories: 525,
        Distance_Miles: 3.19,
        Active_Zone_Min: '',
        Lifting_Summary: '',
        Raw_Source: 'Pixel Watch / Google Health',
        Splits: 'Avg Pace: 20:00 /mi',
      },
      {
        Workout_ID: '7255350028181358216',
        Date: '2026-10-13',
        Start_Time: '18:10',
        End_Time: '18:35',
        Workout_Type: 'Pickleball',
        Total_Duration_Min: 24.8,
        Active_Lift_Min: '',
        Total_Rest_Min: '',
        Avg_HR: 124,
        Max_HR: '',
        HR_Zones: '',
        Calories: 261,
        Distance_Miles: 0.36,
        Active_Zone_Min: 28,
        Lifting_Summary: '',
        Raw_Source: 'Pixel Watch / Google Health',
        Splits: '',
      },
    ],
    sets: [],
    bodyMetrics: [],
  },
};

describe('Backend Schema Adapter & Seamless Normalization', () => {
  beforeEach(async () => {
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

  describe('unwrapBackendPayload', () => {
    it('properly extracts data from nested { status: "ok", data: { ... } } responses', () => {
      const plan = unwrapBackendPayload(SAMPLE_BACKEND_PAYLOAD, 'plan');
      expect(Array.isArray(plan)).toBe(true);
      expect(plan).toHaveLength(3);
      expect(plan[0].Workout_Title).toBe('Lower Body + Core');

      const daily = unwrapBackendPayload(SAMPLE_BACKEND_PAYLOAD, 'dailySummary');
      expect(Array.isArray(daily)).toBe(true);
      expect(daily).toHaveLength(3);

      const sessions = unwrapBackendPayload(SAMPLE_BACKEND_PAYLOAD, 'sessions');
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions).toHaveLength(3);
    });

    it('gracefully handles flat objects and direct arrays for backwards compatibility', () => {
      const flatObj = { plan: [{ title: 'Flat Test' }] };
      expect(unwrapBackendPayload(flatObj, 'plan')).toEqual([{ title: 'Flat Test' }]);

      const directArray = [{ id: 'item_1' }, { id: 'item_2' }];
      expect(unwrapBackendPayload(directArray)).toEqual(directArray);
      expect(unwrapBackendPayload(null, 'plan')).toEqual([]);
    });
  });

  describe('Weekly Plan Normalization & Exercises_JSON parsing', () => {
    it('normalizes single plan items individually using normalizePlanItem', () => {
      const singleItem = normalizePlanItem(SAMPLE_BACKEND_PAYLOAD.data.plan[0], 0);
      expect(singleItem.dayNumber).toBe(1);
      expect(singleItem.activityType).toBe('workout');
      expect(singleItem.targetExercises).toHaveLength(5);
    });

    it('correctly maps snake_case / PascalCase keys to canonical frontend plan keys', () => {
      const normalizedList = normalizeWeeklyPlan(SAMPLE_BACKEND_PAYLOAD.data.plan);
      expect(normalizedList).toHaveLength(3);

      // Day 1 (Lifting)
      const day1 = normalizedList[0];
      expect(day1.dayNumber).toBe(1);
      expect(day1.dayName).toBe('Monday');
      expect(day1.title).toBe('Lower Body + Core');
      expect(day1.badgeLabel).toBe('Lower Body');
      expect(day1.activityType).toBe('workout'); // "Lifting" -> "workout"
      expect(day1.status).toBe('Scheduled');

      // Check Exercises_JSON parsing into targetExercises
      expect(day1.targetExercises).toEqual([
        'Goblet Squat',
        'Romanian Deadlift (Dumbbell)',
        'Walking Lunges',
        'Standing Calf Raises',
        'Deadbugs',
      ]);

      // Check granular exerciseTargets structure
      expect(day1.exerciseTargets).toHaveLength(5);
      expect(day1.exerciseTargets[0]).toEqual({
        exercise: 'Goblet Squat',
        target_sets: 3,
        target_reps: '10-12',
        target_rir: 3,
        rest_sec: 90,
      });

      // Day 2 (Running)
      const day2 = normalizedList[1];
      expect(day2.dayNumber).toBe(2);
      expect(day2.title).toBe('Midweek Easy Run');
      expect(day2.badgeLabel).toBe('Base Run');
      expect(day2.activityType).toBe('run'); // "Running" -> "run"
      expect(day2.targetExercises).toEqual(['Outdoor / Treadmill Run']);

      // Day 7 (Rest)
      const day7 = normalizedList[2];
      expect(day7.dayNumber).toBe(7);
      expect(day7.title).toBe('Active Recovery & Mobility');
      expect(day7.badgeLabel).toBe('Recovery');
      expect(day7.activityType).toBe('rest'); // "Rest" -> "rest"
    });
  });

  describe('Daily Summary Step Tracking Ingestion', () => {
    it('ingests step counts and health metrics into stepsMap and localStorage', () => {
      const stepsMap = ingestDailySummaries(SAMPLE_BACKEND_PAYLOAD.data.dailySummary);

      expect(stepsMap['2026-10-26']).toBe(4885);
      expect(stepsMap['2026-10-27']).toBe(11016);
      expect(stepsMap['2026-11-06']).toBe(4512);

      const storedSteps = JSON.parse(localStorage.getItem(STORAGE_KEY_STEPS));
      expect(storedSteps['2026-11-06']).toBe(4512);
      expect(storedSteps['2026-10-27']).toBe(11016);
    });
  });

  describe('Session Normalization & Activity Type Classification', () => {
    it('normalizes Pixel Watch walk, run, and pickleball sessions cleanly', () => {
      const rawWalk = SAMPLE_BACKEND_PAYLOAD.data.sessions[0];
      const normWalk = normalizeSessionRecord(rawWalk);

      expect(normWalk.sessionId).toBe('7048769566620476000');
      expect(normWalk.workoutName).toBe('Walk');
      expect(normWalk.type).toBe('walk');
      expect(normWalk.Workout_Type).toBe('Walk');
      expect(normWalk.avgHeartRate).toBe(81);
      expect(normWalk.calories).toBe(181);
      expect(normWalk.distanceMiles).toBe(0.8);
      expect(normWalk.avgPace).toBe('38:30 /mi');
      expect(normWalk.highlight).toBe('Avg Pace: 38:30 /mi');
      expect(normWalk.startedAt).toBe('2026-10-31T16:34:00');
      expect(normWalk.endedAt).toBe('2026-10-31T17:04:00');
      expect(normWalk.durationSec).toBe(1848); // 30.8 min * 60
    });

    it('normalizes Treadmill run correctly', () => {
      const rawTreadmill = SAMPLE_BACKEND_PAYLOAD.data.sessions[1];
      const normTreadmill = normalizeSessionRecord(rawTreadmill);

      expect(normTreadmill.workoutName).toBe('Treadmill run');
      expect(normTreadmill.type).toBe('run');
      expect(normTreadmill.distanceMiles).toBe(3.19);
      expect(normTreadmill.avgPace).toBe('20:00 /mi');
      expect(normTreadmill.avgHeartRate).toBe(83);
      expect(normTreadmill.calories).toBe(525);
    });

    it('normalizes Pickleball sport correctly', () => {
      const rawPickleball = SAMPLE_BACKEND_PAYLOAD.data.sessions[2];
      const normPickleball = normalizeSessionRecord(rawPickleball);

      expect(normPickleball.workoutName).toBe('Pickleball');
      expect(normPickleball.type).toBe('pickleball');
      expect(normPickleball.avgHeartRate).toBe(124);
      expect(normPickleball.calories).toBe(261);
    });
  });

  describe('Sibling Sets Joining by Workout_ID', () => {
    it('joins sibling sets array to corresponding session by Workout_ID', () => {
      const mockSessions = [
        {
          Workout_ID: 'sess_chest_1',
          Date: '2026-11-05',
          Workout_Type: 'Lifting',
          Workout_Name: 'Chest Day',
        },
      ];

      const mockSets = [
        {
          Workout_ID: 'sess_chest_1',
          Exercise: 'Bench Press',
          Set_Number: 1,
          Weight_Lbs: 225,
          Reps: 8,
          RIR: 2,
        },
        {
          Workout_ID: 'sess_chest_1',
          Exercise: 'Bench Press',
          Set_Number: 2,
          Weight_Lbs: 225,
          Reps: 7,
          RIR: 1,
        },
      ];

      const joined = joinSessionsAndSets(mockSessions, mockSets);
      expect(joined).toHaveLength(1);

      const session = joined[0];
      expect(session.exercises).toHaveLength(1);
      expect(session.exercises[0].exerciseName).toBe('Bench Press');
      expect(session.exercises[0].sets).toHaveLength(2);
      expect(session.totalSets).toBe(2);
      expect(session.totalVolumeLbs).toBe(225 * 8 + 225 * 7); // 3375 lbs
      expect(session.avgRir).toBe(1.5);
    });
  });

  describe('Full Bundle Sync Ingestion (ingestBackendSyncBundle)', () => {
    it('ingests the entire backend bundle in one seamless step', async () => {
      const results = await ingestBackendSyncBundle(SAMPLE_BACKEND_PAYLOAD);

      expect(results).toBeDefined();
      expect(results.plan).toHaveLength(3);
      expect(results.dailySummary['2026-11-06']).toBe(4512);
      expect(results.sessions).toHaveLength(3);

      // Verify persisted into IndexedDB
      const idbSessions = await getSessions();
      expect(idbSessions).toHaveLength(3);

      // Verify plan stored in localStorage
      const storedPlan = JSON.parse(localStorage.getItem(STORAGE_KEY_PLAN));
      expect(storedPlan).toHaveLength(3);
      expect(storedPlan[0].title).toBe('Lower Body + Core');
      expect(storedPlan[0].activityType).toBe('workout');

      // Verify history log stored in localStorage
      const storedHistory = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY_LOG));
      expect(storedHistory).toHaveLength(3);
    });
  });
});
