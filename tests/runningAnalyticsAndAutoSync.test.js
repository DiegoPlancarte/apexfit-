import {
  parseSplits,
  DEFAULT_SHOES,
  getStoredShoes,
  purgeMockShoes,
  STORAGE_KEY_SHOES,
  LEGACY_STORAGE_KEY_SHOES,
} from '../src/services/runningService';
import {
  normalizeSessionRecord,
  reconcileAndMergeSessions,
  buildWorkoutPayload,
} from '../src/services/api';

describe('Running Analytics, Elevation & Auto-Sync Enhancements', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Full-Mile Split Filtering for Fastest Badge', () => {
    it('excludes partial final splits (< 0.95 mi) from winning the fastest split designation', () => {
      // 3.22-mile run: Mile 1 (9:37), Mile 2 (9:03), Mile 3 (9:18), Mile 4 (2:38 for 0.22 mi)
      const splitsStr = 'M1: 9:37 | M2: 9:03 | M3: 9:18 | M4: 2:38';
      const totalDistanceMiles = 3.22;

      const parsed = parseSplits(splitsStr, totalDistanceMiles);

      expect(parsed).toHaveLength(4);

      // Mile 1, 2, 3 are full miles
      expect(parsed[0].isFullMile).toBe(true);
      expect(parsed[0].splitDistance).toBe(1.0);
      expect(parsed[0].isFastest).toBe(false);

      expect(parsed[1].isFullMile).toBe(true);
      expect(parsed[1].splitDistance).toBe(1.0);
      // Mile 2 (9:03) is the fastest full mile
      expect(parsed[1].isFastest).toBe(true);

      expect(parsed[2].isFullMile).toBe(true);
      expect(parsed[2].splitDistance).toBe(1.0);
      expect(parsed[2].isFastest).toBe(false);

      // Mile 4 (0.22 mi, 2:38 elapsed) is a partial split: MUST NOT win fastest badge!
      expect(parsed[3].isFullMile).toBe(false);
      expect(parsed[3].splitDistance).toBe(0.22);
      expect(parsed[3].isFastest).toBe(false);
      expect(parsed[3].label).toContain('0.22 mi');
    });

    it('correctly parses explicit partial split notation e.g. Rem (0.19m)', () => {
      const splitsStr = 'M1: 8:48 | M2: 8:30 | Rem (0.19m): 1:30';
      const parsed = parseSplits(splitsStr);

      expect(parsed).toHaveLength(3);
      expect(parsed[0].isFullMile).toBe(true);
      expect(parsed[1].isFullMile).toBe(true);
      expect(parsed[1].isFastest).toBe(true); // 8:30 is fastest full mile

      expect(parsed[2].isFullMile).toBe(false);
      expect(parsed[2].splitDistance).toBe(0.19);
      expect(parsed[2].isFastest).toBe(false);
    });

    it('allows full miles near threshold (>= 0.95 mi) to compete for fastest badge', () => {
      // 1.96-mile run where split 2 is 0.96 mi
      const splitsStr = 'M1: 8:40 | M2: 8:15';
      const parsed = parseSplits(splitsStr, 1.96);

      expect(parsed[1].isFullMile).toBe(true);
      expect(parsed[1].splitDistance).toBe(0.96);
      expect(parsed[1].isFastest).toBe(true);
    });
  });

  describe('2. Elevation Data Integration', () => {
    it('normalizes elevation gain across multiple backend formats (Ft and M)', () => {
      // Elevation in feet
      const sessFeet = normalizeSessionRecord({
        Workout_ID: 'run_elev_1',
        Workout_Type: 'Run',
        Distance_Miles: 4.5,
        Elevation_Gain_Ft: 245,
      });
      expect(sessFeet.elevationGainFt).toBe(245);
      expect(sessFeet.Elevation_Gain_Ft).toBe(245);

      // Elevation in meters
      const sessMeters = normalizeSessionRecord({
        sessionId: 'run_elev_2',
        type: 'run',
        distanceMiles: 5.0,
        elevationGainM: 100, // 100 m = ~328 ft
      });
      expect(sessMeters.elevationGainFt).toBe(328);

      // Elevation from generic elevation / altitude fields
      const sessGeneric = normalizeSessionRecord({
        sessionId: 'run_elev_3',
        type: 'run',
        elevationGain: 180,
      });
      expect(sessGeneric.elevationGainFt).toBe(180);
    });

    it('merges elevation gain from wearable session into unified activity session', () => {
      const activeRun = {
        sessionId: 'active_run_1',
        date: '2026-11-10',
        startedAt: '2026-11-10T08:00:00',
        type: 'run',
        durationSec: 1800,
        distanceMiles: 3.2,
      };

      const watchRun = {
        sessionId: 'watch_run_1',
        date: '2026-11-10',
        startedAt: '2026-11-10T08:02:00',
        type: 'run',
        rawSource: 'Pixel Watch / Google Health',
        Avg_HR: 156,
        Calories: 340,
        Elevation_Gain_Ft: 185,
      };

      const merged = reconcileAndMergeSessions([activeRun, watchRun]);
      expect(merged).toHaveLength(1);
      expect(merged[0].elevationGainFt).toBe(185);
      expect(merged[0].avgHeartRate).toBe(156);
      expect(merged[0].calories).toBe(340);
    });

    it('buildWorkoutPayload preserves elevation gain in sync payload', () => {
      const payload = buildWorkoutPayload({
        sessionId: 'run_sync_1',
        workoutType: 'Run',
        workoutName: 'Hill Repeats',
        distanceMiles: 3.5,
        elevationGainFt: 310,
        sets: [{ exerciseName: 'Outdoor Run', setNumber: 1, reps: 1, completed: true }],
      });

      expect(payload.session.Elevation_Gain_Ft).toBe(310);
    });
  });

  describe('3. Shoe Selection State Clean-up', () => {
    it('ensures DEFAULT_SHOES is an empty array without mock shoes', () => {
      expect(DEFAULT_SHOES).toEqual([]);
      expect(DEFAULT_SHOES).toHaveLength(0);
    });

    it('purges mock shoes and legacy iron_log_shoes cache from localStorage', () => {
      localStorage.setItem(LEGACY_STORAGE_KEY_SHOES, JSON.stringify([{ id: 'legacy_old' }]));
      localStorage.setItem(
        STORAGE_KEY_SHOES,
        JSON.stringify([
          { id: 'shoe_pegasus_40', name: 'Nike Pegasus 40', currentMiles: 145.6 },
          { id: 'shoe_user_custom_1', name: 'My Brooks Ghost', currentMiles: 25.0 },
        ])
      );

      purgeMockShoes();

      // Legacy key removed
      expect(localStorage.getItem(LEGACY_STORAGE_KEY_SHOES)).toBeNull();

      // Only real user shoe remains
      const stored = getStoredShoes();
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('My Brooks Ghost');
      expect(stored[0].currentMiles).toBe(25.0);
    });
  });
});
