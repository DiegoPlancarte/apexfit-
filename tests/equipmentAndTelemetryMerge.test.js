import {
  RESISTANCE_BANDS,
  getExerciseMeta,
  isUnilateralExercise,
  isDualImplementExercise,
  isBandExercise,
  getExerciseCues,
  calculateSetWorkVolume,
} from '../src/services/exerciseLibrary';
import {
  reconcileAndMergeSessions,
  isWearableSource,
  buildWorkoutPayload,
  joinSessionsAndSets,
} from '../src/services/api';
import { getMondayOfWeek, getSundayOfWeek, formatWeekRangeDisplay, formatDateToIso } from '../src/components/HistoryLog/hooks';

describe('Equipment, Weight Tracking & Resistance Bands (HB-AB01)', () => {
  it('correctly provides continuous loop resistance band specs matching HB-AB01', () => {
    expect(RESISTANCE_BANDS).toHaveLength(5);

    const [xLight, light, medium, heavy, xHeavy] = RESISTANCE_BANDS;

    expect(xLight).toMatchObject({
      id: 'hb-ab01-xlight',
      level: 'X-Light',
      color: 'Yellow',
      dimensions: '2080 x 10 x 4.5 mm',
      minTension: 5,
      maxTension: 30,
      label: 'X-Light (5–30 lbs)',
      hex: '#eab308',
    });

    expect(light).toMatchObject({
      id: 'hb-ab01-light',
      level: 'Light',
      color: 'Red',
      dimensions: '2080 x 15 x 4.5 mm',
      minTension: 15,
      maxTension: 60,
      label: 'Light (15–60 lbs)',
      hex: '#ef4444',
    });

    expect(medium).toMatchObject({
      id: 'hb-ab01-medium',
      level: 'Medium',
      color: 'Black',
      dimensions: '2080 x 22 x 4.5 mm',
      minTension: 35,
      maxTension: 110,
      label: 'Medium (35–110 lbs)',
      hex: '#1f2937',
    });

    expect(heavy).toMatchObject({
      id: 'hb-ab01-heavy',
      level: 'Heavy',
      color: 'Purple',
      dimensions: '2080 x 35 x 4.5 mm',
      minTension: 50,
      maxTension: 135,
      label: 'Heavy (50–135 lbs)',
      hex: '#a855f7',
    });

    expect(xHeavy).toMatchObject({
      id: 'hb-ab01-xheavy',
      level: 'X-Heavy',
      color: 'Green',
      dimensions: '2080 x 52 x 4.5 mm',
      minTension: 60,
      maxTension: 170,
      label: 'X-Heavy (60–170 lbs)',
      hex: '#22c55e',
    });
  });

  it('identifies band exercises properly', () => {
    expect(isBandExercise('Band Face Pulls')).toBe(true);
    expect(isBandExercise('Resistance Band Pull-Apart')).toBe(true);
    expect(isBandExercise('Barbell Bench Press')).toBe(false);
  });

  it('routes equipment types accurately away from barbell plate calculator', () => {
    // Goblet Squat should route to Dumbbell / Kettlebell, not Barbell
    const gobletMeta = getExerciseMeta('Goblet Squat');
    expect(gobletMeta.equipment).toBe('Dumbbell');

    // Romanian Deadlift (Dumbbell)
    const dbRdlMeta = getExerciseMeta('Romanian Deadlift (Dumbbell)');
    expect(dbRdlMeta.equipment).toBe('Dumbbell');

    // Barbell Back Squat
    const bSquatMeta = getExerciseMeta('Barbell Back Squat');
    expect(bSquatMeta.equipment).toBe('Barbell');

    // Kettlebell Swings
    const kbMeta = getExerciseMeta('Kettlebell Swings');
    expect(kbMeta.equipment).toBe('Kettlebell');
  });

  it('detects unilateral movements requiring per-side tracking', () => {
    expect(isUnilateralExercise('Walking Lunges')).toBe(true);
    expect(isUnilateralExercise('Bulgarian Split Squat')).toBe(true);
    expect(isUnilateralExercise('Single-Leg Romanian Deadlift')).toBe(true);
    expect(isUnilateralExercise('Dumbbell Step-Ups')).toBe(true);
    expect(isUnilateralExercise('Barbell Bench Press')).toBe(false);
  });

  it('calculates dual-implement volume with x2 multiplier standard', () => {
    // Dual Dumbbells: User logs 30 lbs per hand for 10 reps -> 30 * 2 * 10 = 600 lbs
    expect(isDualImplementExercise('Dumbbell Bench Press')).toBe(true);
    const volumeDualDb = calculateSetWorkVolume('Dumbbell Bench Press', 30, 10);
    expect(volumeDualDb).toBe(600);

    // Incline Dumbbell Bench Press: 50 lbs * 2 * 8 = 800 lbs
    expect(isDualImplementExercise('Incline Dumbbell Bench Press')).toBe(true);
    const volumeIncline = calculateSetWorkVolume('Incline Dumbbell Bench Press', 50, 8);
    expect(volumeIncline).toBe(800);

    // Single Implement (Goblet Squat): 50 lbs * 10 reps = 500 lbs (no x2)
    expect(isDualImplementExercise('Goblet Squat')).toBe(false);
    const volumeGoblet = calculateSetWorkVolume('Goblet Squat', 50, 10);
    expect(volumeGoblet).toBe(500);

    // Barbell: 225 lbs * 5 reps = 1125 lbs (no x2)
    const volumeBarbell = calculateSetWorkVolume('Barbell Back Squat', 225, 5);
    expect(volumeBarbell).toBe(1125);
  });

  it('provides rich mid-session coaching cues', () => {
    const gobletCues = getExerciseCues('Goblet Squat');
    expect(gobletCues).toBeDefined();
    expect(typeof gobletCues).toBe('string');
    expect(gobletCues.length).toBeGreaterThan(0);
    expect(gobletCues.toLowerCase()).toContain('knees');

    const dbRdlCues = getExerciseCues('Romanian Deadlift (Dumbbell)');
    expect(typeof dbRdlCues).toBe('string');
    expect(dbRdlCues.toLowerCase()).toContain('hinge');
  });

  it('integrates dual implement volume in buildWorkoutPayload', () => {
    const payload = buildWorkoutPayload({
      workoutName: 'Upper Body Test',
      workoutType: 'Strength',
      date: '2026-11-09',
      exercises: [
        {
          name: 'Dumbbell Bench Press',
          sets: [
            { weightLbs: 40, reps: 10, completed: true },
            { weightLbs: 40, reps: 10, completed: true },
          ],
        },
      ],
    });

    // 40 * 2 * 10 = 800 per set -> 1600 lbs total
    expect(payload.session.totalVolumeLbs).toBe(1600);
    expect(payload.session.Total_Volume_Lbs).toBe(1600);
  });
});

describe('Dashboard Week Navigator & Date Calculations', () => {
  it('correctly computes Monday and Sunday of any given date', () => {
    // 2026-11-09 is a Monday
    const date = new Date('2026-11-09T12:00:00');
    const monday = getMondayOfWeek(date);
    expect(formatDateToIso(monday)).toBe('2026-11-09');

    const sunday = getSundayOfWeek(monday);
    expect(formatDateToIso(sunday)).toBe('2026-11-15');

    // Midweek Wednesday 2026-11-11
    const wed = new Date('2026-11-11T15:30:00');
    expect(formatDateToIso(getMondayOfWeek(wed))).toBe('2026-11-09');
  });

  it('formats training week display ranges nicely', () => {
    const display = formatWeekRangeDisplay('2026-11-09', '2026-11-15');
    expect(display).toBe('Nov 9 – 15, 2026');
  });
});

describe('Passive Wearable Telemetry Reconciliation (Pixel Watch / Google Health)', () => {
  it('identifies wearable sources accurately', () => {
    expect(isWearableSource({ rawSource: 'Pixel Watch / Google Health' })).toBe(true);
    expect(isWearableSource({ Raw_Source: 'Google Health' })).toBe(true);
    expect(isWearableSource({ rawSource: 'Health Connect' })).toBe(true);
    expect(isWearableSource({ rawSource: 'Apple Watch' })).toBe(true);
    expect(isWearableSource({ rawSource: 'Fitbit' })).toBe(true);
    expect(isWearableSource({ rawSource: 'ApexFit' })).toBe(false);
    expect(isWearableSource({})).toBe(false);
  });

  it('merges passive Pixel Watch telemetry into active lifting session on the same date', () => {
    const activeLifting = {
      sessionId: 'sess_123',
      date: '2026-11-06',
      startedAt: '2026-11-06T09:00:00',
      type: 'workout',
      Workout_Type: 'Strength',
      workoutName: 'Lower Body Focus',
      durationSec: 2700,
      totalVolumeLbs: 8500,
      totalSets: 12,
      rawSource: 'ApexFit',
      exercises: [
        {
          exerciseName: 'Goblet Squat',
          sets: [{ weightLbs: 60, reps: 10 }],
        },
      ],
    };

    const watchRecord = {
      sessionId: 'watch_456',
      date: '2026-11-06',
      Start_Time: '09:10',
      End_Time: '09:55',
      Workout_Type: 'Strength',
      avgHeartRate: 142,
      calories: 430,
      rawSource: 'Pixel Watch / Google Health',
      sets: [],
    };

    const merged = reconcileAndMergeSessions([activeLifting, watchRecord]);

    // Should merge into 1 composite session without duplicate cards
    expect(merged).toHaveLength(1);
    const session = merged[0];
    expect(session.sessionId).toBe('sess_123');
    expect(session.totalVolumeLbs).toBe(8500);
    expect(session.avgHeartRate).toBe(142);
    expect(session.calories).toBe(430);
    expect(session.isMergedTelemetry).toBe(true);
    expect(session.wearableAttribution).toContain('Pixel Watch');
    expect(session.rawSource).toContain('Pixel Watch');
  });

  it('merges passive Pixel Watch telemetry into active run session on the same date', () => {
    const activeRun = {
      sessionId: 'sess_run_1',
      date: '2026-11-06',
      startedAt: '2026-11-06T09:14:00',
      type: 'run',
      Workout_Type: 'Run',
      workoutName: 'Morning 2-Miler',
      distanceMiles: 2.05,
      rawSource: 'ApexFit',
    };

    const watchRun = {
      sessionId: '1877189273535700890',
      Date: '2026-11-06',
      Start_Time: '09:14',
      End_Time: '09:33',
      Workout_Type: 'Run',
      Total_Duration_Min: 18.4,
      Avg_HR: 165,
      Calories: 314,
      Distance_Miles: 2.05,
      Raw_Source: 'Pixel Watch / Google Health',
      Splits: 'M1: 8:48 | M2: 9:14 | M3: 0:22',
    };

    const merged = reconcileAndMergeSessions([activeRun, watchRun]);

    expect(merged).toHaveLength(1);
    const session = merged[0];
    expect(session.distanceMiles).toBe(2.05);
    expect(session.avgHeartRate).toBe(165);
    expect(session.calories).toBe(314);
    expect(session.splits).toBe('M1: 8:48 | M2: 9:14 | M3: 0:22');
    expect(session.isMergedTelemetry).toBe(true);
  });

  it('preserves standalone passive wearable sessions when no active session matches', () => {
    const passiveWalk = {
      sessionId: 'watch_walk_1',
      Date: '2026-10-31',
      Start_Time: '16:34',
      Workout_Type: 'Walk',
      Total_Duration_Min: 30.8,
      Avg_HR: 81,
      Calories: 181,
      Distance_Miles: 0.8,
      Raw_Source: 'Pixel Watch / Google Health',
      Splits: 'Avg Pace: 38:30 /mi',
    };

    const merged = reconcileAndMergeSessions([passiveWalk]);
    expect(merged).toHaveLength(1);
    expect(merged[0].type).toBe('walk');
    expect(merged[0].avgHeartRate).toBe(81);
    expect(merged[0].calories).toBe(181);
  });

  it('preserves both when active lifting and passive walk occur on the same day without merging unrelated types', () => {
    const activeLifting = {
      sessionId: 'sess_lift',
      date: '2026-10-31',
      type: 'workout',
      Workout_Type: 'Strength',
      workoutName: 'Heavy Legs',
      totalVolumeLbs: 12000,
      totalSets: 15,
      rawSource: 'ApexFit',
      exercises: [{ exerciseName: 'Barbell Back Squat', sets: [{ weightLbs: 225, reps: 5 }] }],
    };

    const afternoonWalk = {
      sessionId: 'watch_walk',
      Date: '2026-10-31',
      Start_Time: '16:34',
      Workout_Type: 'Walk',
      Avg_HR: 81,
      Calories: 181,
      Distance_Miles: 0.8,
      Raw_Source: 'Pixel Watch / Google Health',
    };

    const merged = reconcileAndMergeSessions([activeLifting, afternoonWalk]);
    // Different activity types: should remain 2 separate cards!
    expect(merged).toHaveLength(2);
    const lifting = merged.find((s) => s.type === 'workout');
    const walk = merged.find((s) => s.type === 'walk');
    expect(lifting).toBeDefined();
    expect(walk).toBeDefined();
    expect(lifting.isMergedTelemetry).toBeFalsy();
    expect(walk.distanceMiles).toBe(0.8);
  });

  it('joins sibling sets and merges telemetry via joinSessionsAndSets', () => {
    const rawSessions = [
      {
        Workout_ID: 'w_1',
        Date: '2026-11-06',
        Workout_Type: 'Strength',
        Workout_Name: 'Chest & Back',
        Raw_Source: 'ApexFit',
      },
      {
        Workout_ID: 'w_watch',
        Date: '2026-11-06',
        Workout_Type: 'Strength',
        Avg_HR: 138,
        Calories: 390,
        Raw_Source: 'Pixel Watch / Google Health',
      },
    ];

    const rawSets = [
      {
        Workout_ID: 'w_1',
        Exercise: 'Dumbbell Bench Press',
        Weight_Lbs: 35,
        Reps: 10,
      },
    ];

    const result = joinSessionsAndSets(rawSessions, rawSets);
    expect(result).toHaveLength(1);
    expect(result[0].avgHeartRate).toBe(138);
    expect(result[0].calories).toBe(390);
    // Dual DBs 35 * 2 * 10 = 700 lbs
    expect(result[0].totalVolumeLbs).toBe(700);
    expect(result[0].isMergedTelemetry).toBe(true);
  });
});
