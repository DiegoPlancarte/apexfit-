import {
  parseSplits,
  formatDeltaPace,
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

  describe('1. Full-Mile Split Filtering & Delta Formatting (Excluding Partial Tails)', () => {
    it('excludes partial final splits (< 0.95 mi) from fastest split, delta tags, and relative comparisons', () => {
      // 3.22-mile run: Mile 1 (9:37 = 577s), Mile 2 (9:03 = 543s), Mile 3 (9:18 = 558s), Mile 4 (2:38 for 0.22 mi)
      // Full miles avg = (577 + 543 + 558) / 3 = 559s (9:19)
      const splitsStr = 'M1: 9:37 | M2: 9:03 | M3: 9:18 | M4: 2:38';
      const totalDistanceMiles = 3.22;

      const parsed = parseSplits(splitsStr, totalDistanceMiles);

      expect(parsed).toHaveLength(4);

      // Mile 1, 2, 3 are full miles
      expect(parsed[0].isFullMile).toBe(true);
      expect(parsed[0].splitDistance).toBe(1.0);
      expect(parsed[0].isFastest).toBe(false);
      // Mile 1 delta: 577 - 559 = +18s -> "+0:18" (slower than avg)
      expect(parsed[0].deltaFormatted).toBe('+0:18');
      expect(parsed[0].deltaType).toBe('slower');

      expect(parsed[1].isFullMile).toBe(true);
      expect(parsed[1].splitDistance).toBe(1.0);
      // Mile 2 (9:03) is fastest full mile; delta: 543 - 559 = -16s -> "-0:16" (faster than avg)
      expect(parsed[1].isFastest).toBe(true);
      expect(parsed[1].deltaFormatted).toBe('-0:16');
      expect(parsed[1].deltaType).toBe('faster');

      expect(parsed[2].isFullMile).toBe(true);
      expect(parsed[2].splitDistance).toBe(1.0);
      expect(parsed[2].isFastest).toBe(false);
      // Mile 3 delta: 558 - 559 = -1s -> "-0:01"
      expect(parsed[2].deltaFormatted).toBe('-0:01');
      expect(parsed[2].deltaType).toBe('faster');

      // Mile 4 (0.22 mi, 2:38 elapsed) is a partial split:
      // MUST NOT win fastest badge and MUST render in neutral non-competitive state with no green/orange delta tags
      expect(parsed[3].isFullMile).toBe(false);
      expect(parsed[3].splitDistance).toBe(0.22);
      expect(parsed[3].isFastest).toBe(false);
      expect(parsed[3].isSlowest).toBe(false);
      expect(parsed[3].deltaFormatted).toBeNull();
      expect(parsed[3].deltaType).toBe('neutral');
      expect(parsed[3].label).toContain('0.22 mi');
    });

    it('correctly parses explicit partial split notation e.g. Rem (0.19m) and neutralizes delta', () => {
      const splitsStr = 'M1: 8:48 | M2: 8:30 | Rem (0.19m): 1:30';
      const parsed = parseSplits(splitsStr);

      expect(parsed).toHaveLength(3);
      expect(parsed[0].isFullMile).toBe(true);
      expect(parsed[1].isFullMile).toBe(true);
      expect(parsed[1].isFastest).toBe(true); // 8:30 is fastest full mile

      expect(parsed[2].isFullMile).toBe(false);
      expect(parsed[2].splitDistance).toBe(0.19);
      expect(parsed[2].isFastest).toBe(false);
      expect(parsed[2].deltaFormatted).toBeNull();
      expect(parsed[2].deltaType).toBe('neutral');
    });

    it('allows full miles near threshold (>= 0.95 mi) to compete for fastest badge', () => {
      // 1.96-mile run where split 2 is 0.96 mi
      const splitsStr = 'M1: 8:40 | M2: 8:15';
      const parsed = parseSplits(splitsStr, 1.96);

      expect(parsed[1].isFullMile).toBe(true);
      expect(parsed[1].splitDistance).toBe(0.96);
      expect(parsed[1].isFastest).toBe(true);
    });

    it('formatDeltaPace converts raw seconds into human-readable ±M:SS pace convention', () => {
      expect(formatDeltaPace(163)).toBe('+2:43');
      expect(formatDeltaPace(89)).toBe('+1:29');
      expect(formatDeltaPace(-366)).toBe('-6:06');
      expect(formatDeltaPace(-10)).toBe('-0:10');
      expect(formatDeltaPace(0)).toBe('0:00');
      expect(formatDeltaPace(null)).toBeNull();
      expect(formatDeltaPace(undefined)).toBeNull();
      expect(formatDeltaPace(NaN)).toBeNull();
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
