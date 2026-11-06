import {
  normalizeOutboxPayload,
} from '../src/services/db';
import {
  buildWorkoutPayload,
  buildRunPayload,
  normalizeSetRecord,
} from '../src/services/api';

describe('Payload Normalization & Google Sheets Schema Mapping', () => {
  describe('normalizeOutboxPayload - Lifting Workout Sessions', () => {
    it('correctly maps camelCase workout session and set properties to snake_case column names', () => {
      const rawPayload = {
        action: 'logWorkoutSession',
        sessionId: 'sess_1234567890',
        date: '2026-11-04',
        workoutType: 'Strength',
        workoutName: 'Upper Body Hypertrophy',
        durationSec: 3600,
        distanceMiles: 0,
        totalVolumeLbs: 4500,
        notes: 'High volume bench session',
        sets: [
          {
            sessionId: 'sess_1234567890',
            date: '2026-11-04',
            exerciseName: 'Barbell Bench Press',
            setNumber: 1,
            weightLbs: 225,
            reps: 8,
            rir: 2,
            setActiveSec: 35,
            restAfterSec: 90,
            completedAt: '2026-11-04T18:30:00.000Z',
          },
          {
            sessionId: 'sess_1234567890',
            date: '2026-11-04',
            exerciseName: 'Incline Dumbbell Press',
            setNumber: 2,
            weightLbs: 70,
            reps: 10,
            rir: 1,
            setActiveSec: 40,
            restAfterSec: 75,
            completedAt: '2026-11-04T18:35:00.000Z',
          },
        ],
      };

      const normalized = normalizeOutboxPayload('logWorkoutSession', rawPayload);

      expect(normalized.action).toBe('logWorkoutSession');
      expect(normalized.session).toBeDefined();

      const session = normalized.session;
      expect(session.Workout_ID).toBe('sess_1234567890');
      expect(session.Date).toBe('2026-11-04');
      expect(session.Workout_Type).toBe('Strength');
      expect(session.Workout_Name).toBe('Upper Body Hypertrophy');
      expect(session.Total_Duration_Min).toBe(60); // 3600 / 60
      expect(session.Distance_Miles).toBe(0);
      expect(session.Total_Volume_Lbs).toBe(4500);
      expect(session.Notes).toBe('High volume bench session');

      expect(Array.isArray(normalized.sets)).toBe(true);
      expect(normalized.sets).toHaveLength(2);

      const set1 = normalized.sets[0];
      expect(set1.Workout_ID).toBe('sess_1234567890');
      expect(set1.Date).toBe('2026-11-04');
      expect(set1.Exercise).toBe('Barbell Bench Press');
      expect(set1.Set_Number).toBe(1);
      expect(set1.Weight_Lbs).toBe(225);
      expect(set1.Reps).toBe(8);
      expect(set1.RIR).toBe(2);
      expect(set1.Set_Active_Sec).toBe(35);
      expect(set1.Rest_After_Sec).toBe(90);

      const set2 = normalized.sets[1];
      expect(set2.Workout_ID).toBe('sess_1234567890');
      expect(set2.Exercise).toBe('Incline Dumbbell Press');
      expect(set2.Set_Number).toBe(2);
      expect(set2.Weight_Lbs).toBe(70);
      expect(set2.Reps).toBe(10);
      expect(set2.RIR).toBe(1);
    });

    it('calculates total volume and duration in minutes when omitted', () => {
      const rawPayload = {
        sessionId: 'sess_auto_calc',
        durationSec: 1800, // 30 minutes
        sets: [
          { exerciseName: 'Deadlift', setNumber: 1, weightLbs: 315, reps: 5, rir: 2 },
          { exerciseName: 'Deadlift', setNumber: 2, weightLbs: 315, reps: 5, rir: 1 },
        ],
      };

      const normalized = normalizeOutboxPayload('logWorkoutSession', rawPayload);
      expect(normalized.session.Total_Duration_Min).toBe(30);
      // Volume = 315*5 + 315*5 = 3150
      expect(normalized.session.Total_Volume_Lbs).toBe(3150);
    });
  });

  describe('normalizeOutboxPayload - Running / Cardio Sessions', () => {
    it('correctly maps cardio run payloads to Google Sheets snake_case column names', () => {
      const rawPayload = {
        action: 'logRunWorkout',
        sessionId: 'run_998877',
        date: '2026-11-03',
        workoutName: 'Morning 5K Tempo',
        totalDurationMin: 25.5,
        distanceMiles: 3.11,
        avgPace: '8:12',
        terrain: 'Road',
        shoeName: 'Nike Pegasus 40',
        avgHeartRate: 154,
        notes: 'Felt strong throughout tempo intervals',
      };

      const normalized = normalizeOutboxPayload('logRunWorkout', rawPayload);

      expect(normalized.action).toBe('logRunWorkout');
      const session = normalized.session;
      expect(session.Workout_ID).toBe('run_998877');
      expect(session.Date).toBe('2026-11-03');
      expect(session.Workout_Type).toBe('Run');
      expect(session.Workout_Name).toBe('Morning 5K Tempo');
      expect(session.Total_Duration_Min).toBe(25.5);
      expect(session.Distance_Miles).toBe(3.11);
      expect(session.Avg_Pace).toBe('8:12');
      expect(session.Terrain).toBe('Road');
      expect(session.Shoe_Name).toBe('Nike Pegasus 40');
      expect(session.Avg_Heart_Rate).toBe(154);
      expect(session.Notes).toBe('Felt strong throughout tempo intervals');
    });
  });

  describe('normalizeOutboxPayload - Body Metrics & Shoe Rotation', () => {
    it('correctly maps body metric records to Metric_ID, Date, Weight_Lbs, Body_Fat_Pct', () => {
      const rawMetric = {
        id: 'metric_99',
        date: '2026-11-04',
        weightLbs: 177.8,
        bodyFatPct: 14.6,
        notes: 'Fasted weigh-in',
      };

      const normalized = normalizeOutboxPayload('logBodyMetric', { metric: rawMetric });
      expect(normalized.action).toBe('logBodyMetric');
      expect(normalized.metric.Metric_ID).toBe('metric_99');
      expect(normalized.metric.Date).toBe('2026-11-04');
      expect(normalized.metric.Weight_Lbs).toBe(177.8);
      expect(normalized.metric.Body_Fat_Pct).toBe(14.6);
      expect(normalized.metric.Notes).toBe('Fasted weigh-in');
    });

    it('correctly maps shoe fleet records to Shoe_ID, Shoe_Name, Brand, Current_Miles, Max_Miles', () => {
      const rawShoe = {
        id: 'shoe_pegasus',
        name: 'Nike Pegasus 40',
        brand: 'Nike',
        currentMiles: 152.3,
        maxMiles: 350,
        isActive: true,
        terrain: 'Road',
      };

      const normalized = normalizeOutboxPayload('updateShoeFleet', { shoe: rawShoe });
      expect(normalized.action).toBe('updateShoeFleet');
      expect(normalized.shoe.Shoe_ID).toBe('shoe_pegasus');
      expect(normalized.shoe.Shoe_Name).toBe('Nike Pegasus 40');
      expect(normalized.shoe.Brand).toBe('Nike');
      expect(normalized.shoe.Current_Miles).toBe(152.3);
      expect(normalized.shoe.Max_Miles).toBe(350);
      expect(normalized.shoe.Is_Active).toBe(true);
      expect(normalized.shoe.Terrain).toBe('Road');
    });
  });

  describe('api.js Payload Builders', () => {
    it('buildWorkoutPayload builds canonical session and set records', () => {
      const workoutState = {
        sessionId: 'sess_api_test',
        workoutName: 'Pull Day',
        durationSec: 2700,
        notes: 'Back & Biceps',
        exercises: [
          {
            exerciseName: 'Lat Pulldown',
            sets: [
              { weightLbs: 160, reps: 10, rir: 2, setActiveSec: 35, restAfterSec: 60, completed: true },
              { weightLbs: 160, reps: 9, rir: 1, setActiveSec: 35, restAfterSec: 60, completed: true },
              { weightLbs: 160, reps: 8, rir: 0, setActiveSec: 35, restAfterSec: 0, completed: false }, // omitted
            ],
          },
        ],
      };

      const payload = buildWorkoutPayload(workoutState);

      expect(payload.action).toBe('logWorkoutSession');
      expect(payload.session.Workout_ID).toBe('sess_api_test');
      expect(payload.session.Workout_Name).toBe('Pull Day');
      expect(payload.session.Total_Duration_Min).toBe(45); // 2700 / 60
      // Only completed sets should be included
      expect(payload.sets).toHaveLength(2);
      expect(payload.sets[0].Exercise).toBe('Lat Pulldown');
      expect(payload.sets[0].Weight_Lbs).toBe(160);
      expect(payload.sets[0].Reps).toBe(10);
      expect(payload.sets[0].RIR).toBe(2);
    });

    it('buildRunPayload correctly populates running metadata', () => {
      const runParams = {
        sessionId: 'run_build_test',
        date: '2026-11-04',
        title: 'Zone 2 Long Run',
        distanceMiles: 8.5,
        durationSec: 4320, // 72 min
        avgPace: '8:28 /mi',
        terrain: 'Trail',
        shoeName: 'Hoka Speedgoat 5',
        shoeId: 'shoe_trail',
        avgHeartRate: 142,
        notes: 'Smooth, continuous aerobic base run',
      };

      const payload = buildRunPayload(runParams);

      expect(payload.action).toBe('logRunWorkout');
      expect(payload.session.Workout_ID).toBe('run_build_test');
      expect(payload.session.Workout_Name).toBe('Zone 2 Long Run');
      expect(payload.session.Workout_Type).toBe('Run');
      expect(payload.session.Distance_Miles).toBe(8.5);
      expect(payload.session.Total_Duration_Min).toBe(72);
      expect(payload.session.Avg_Pace).toBe('8:28 /mi');
      expect(payload.session.Terrain).toBe('Trail');
      expect(payload.session.Shoe_Name).toBe('Hoka Speedgoat 5');
      expect(payload.session.Avg_Heart_Rate).toBe(142);
      expect(payload.session.Notes).toBe('Smooth, continuous aerobic base run');
    });

    it('normalizeSetRecord handles string inputs and defaults', () => {
      const raw = {
        exerciseName: 'Squat',
        weightLbs: '275.5',
        reps: '5',
        rir: '2',
      };

      const normalized = normalizeSetRecord(raw, 'Squat', 0);
      expect(normalized.exerciseName).toBe('Squat');
      expect(normalized.setNumber).toBe(1);
      expect(normalized.weightLbs).toBe(275.5);
      expect(normalized.reps).toBe(5);
      expect(normalized.rir).toBe(2);
    });
  });
});
