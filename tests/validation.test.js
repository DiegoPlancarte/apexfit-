import {
  calculatePlates,
} from '../src/components/PlateCalculator/hooks';
import {
  roundToHalf,
  detectEquipmentType,
} from '../src/components/WeightPickerModal/hooks';
import {
  paceToSeconds,
  secondsToPace,
  parseSplits,
  getShoeHealth,
  addMilesToShoe,
  getStoredShoes,
  saveStoredShoes,
  RETIREMENT_THRESHOLD_MILES,
} from '../src/services/runningService';
import {
  searchExercises,
  getAllExercises,
} from '../src/services/exerciseLibrary';
import {
  extractProgressiveOverloadHistory,
} from '../src/services/db';

describe('Input Validation Guardrails & Calculation Utilities', () => {
  describe('Plate Calculator Guardrails (calculatePlates)', () => {
    it('handles negative or zero target weight safely', () => {
      const negativeResult = calculatePlates(-50, 45);
      expect(negativeResult.weightPerSide).toBe(0);
      expect(negativeResult.platesNeeded).toEqual([]);
      expect(negativeResult.totalLoadedWeight).toBe(45);
      expect(negativeResult.isUnderBarWeight).toBe(false);

      const zeroResult = calculatePlates(0, 45);
      expect(zeroResult.weightPerSide).toBe(0);
      expect(zeroResult.platesNeeded).toEqual([]);
    });

    it('identifies target weight below barbell weight (isUnderBarWeight: true)', () => {
      const underResult = calculatePlates(35, 45);
      expect(underResult.isUnderBarWeight).toBe(true);
      expect(underResult.weightPerSide).toBe(0);
      expect(underResult.platesNeeded).toEqual([]);
      expect(underResult.totalLoadedWeight).toBe(45);
    });

    it('correctly calculates plate denominations for standard weights', () => {
      // 135 lbs with 45 lb bar = 45 per side (1x45)
      const res135 = calculatePlates(135, 45);
      expect(res135.weightPerSide).toBe(45);
      expect(res135.platesNeeded).toEqual([
        { weight: 45, count: 1, totalWeight: 45 },
      ]);
      expect(res135.remainderPerSide).toBe(0);
      expect(res135.totalLoadedWeight).toBe(135);

      // 225 lbs with 45 lb bar = 90 per side (2x45)
      const res225 = calculatePlates(225, 45);
      expect(res225.weightPerSide).toBe(90);
      expect(res225.platesNeeded).toEqual([
        { weight: 45, count: 2, totalWeight: 90 },
      ]);

      // 185 lbs with 45 lb bar = 70 per side (1x45, 1x25)
      const res185 = calculatePlates(185, 45);
      expect(res185.weightPerSide).toBe(70);
      expect(res185.platesNeeded).toEqual([
        { weight: 45, count: 1, totalWeight: 45 },
        { weight: 25, count: 1, totalWeight: 25 },
      ]);
    });

    it('reports remainder when weight cannot be evenly divided with available plates', () => {
      // 137 lbs = 46 per side -> 1x45 lb plate + 1 lb remainder
      const res137 = calculatePlates(137, 45);
      expect(res137.weightPerSide).toBe(46);
      expect(res137.platesNeeded).toEqual([
        { weight: 45, count: 1, totalWeight: 45 },
      ]);
      expect(res137.remainderPerSide).toBe(1);
    });
  });

  describe('Weight Picker Guardrails (roundToHalf & detectEquipmentType)', () => {
    it('roundToHalf sanitizes invalid inputs, empty strings, null, and NaN', () => {
      expect(roundToHalf('')).toBe('');
      expect(roundToHalf(null)).toBe('');
      expect(roundToHalf(undefined)).toBe('');
      expect(roundToHalf('not-a-number')).toBe('');
    });

    it('roundToHalf rounds numeric inputs to the nearest 0.5 increment', () => {
      expect(roundToHalf(22.1)).toBe(22);
      expect(roundToHalf(22.3)).toBe(22.5);
      expect(roundToHalf(22.4)).toBe(22.5);
      expect(roundToHalf(22.7)).toBe(22.5);
      expect(roundToHalf(22.8)).toBe(23);
      expect(roundToHalf('50.25')).toBe(50.5);
    });

    it('detectEquipmentType classifies exercises accurately', () => {
      expect(detectEquipmentType('Incline Dumbbell Press')).toBe('dumbbell');
      expect(detectEquipmentType('Dumbbell Lateral Raise')).toBe('dumbbell');
      expect(detectEquipmentType('Lat Pulldown')).toBe('cable');
      expect(detectEquipmentType('Cable Face Pull')).toBe('cable');
      expect(detectEquipmentType('Leg Press Machine')).toBe('machine');
      expect(detectEquipmentType('Hack Squat')).toBe('machine');
      expect(detectEquipmentType('Barbell Deadlift')).toBe('general');
    });
  });

  describe('Pace & Split Conversions (paceToSeconds, secondsToPace, parseSplits)', () => {
    it('paceToSeconds parses clean and formatted strings', () => {
      expect(paceToSeconds('8:30')).toBe(510);
      expect(paceToSeconds('08:30 /mi')).toBe(510);
      expect(paceToSeconds('10:05')).toBe(605);
      expect(paceToSeconds('')).toBe(0);
      expect(paceToSeconds(null)).toBe(0);
      expect(paceToSeconds('invalid')).toBe(0);
    });

    it('secondsToPace formats seconds to M:SS', () => {
      expect(secondsToPace(510)).toBe('8:30');
      expect(secondsToPace(605)).toBe('10:05');
      expect(secondsToPace(65)).toBe('1:05');
      expect(secondsToPace(0)).toBe('0:00');
      expect(secondsToPace(-10)).toBe('0:00');
      expect(secondsToPace(null)).toBe('0:00');
    });

    it('parseSplits handles pipe, semicolon, or comma delimiters and marks fastest/slowest splits', () => {
      const splitStr = 'M1: 8:45 | M2: 8:15 | M3: 8:30';
      const parsed = parseSplits(splitStr);

      expect(parsed).toHaveLength(3);
      expect(parsed[0].pace).toBe('8:45 /mi');
      expect(parsed[1].pace).toBe('8:15 /mi');
      expect(parsed[2].pace).toBe('8:30 /mi');

      // M2 is fastest (8:15 = 495s)
      expect(parsed[1].isFastest).toBe(true);
      // M1 is slowest (8:45 = 525s)
      expect(parsed[0].isSlowest).toBe(true);
    });

    it('parseSplits returns empty array for empty or malformed strings', () => {
      expect(parseSplits('')).toEqual([]);
      expect(parseSplits(null)).toEqual([]);
      expect(parseSplits('   ')).toEqual([]);
    });
  });

  describe('Shoe Tracker Mileage & Health Guardrails', () => {
    beforeEach(() => {
      saveStoredShoes([
        {
          id: 'test_shoe_1',
          name: 'Pegasus 40',
          currentMiles: 100,
          maxMiles: 350,
          isActive: true,
        },
      ]);
    });

    it('addMilesToShoe rejects negative numbers, zero, or non-finite miles', () => {
      const initialShoes = getStoredShoes();
      expect(initialShoes[0].currentMiles).toBe(100);

      // Negative miles rejected
      addMilesToShoe('test_shoe_1', -5);
      expect(getStoredShoes()[0].currentMiles).toBe(100);

      // Zero miles rejected
      addMilesToShoe('test_shoe_1', 0);
      expect(getStoredShoes()[0].currentMiles).toBe(100);

      // NaN rejected
      addMilesToShoe('test_shoe_1', 'not-a-number');
      expect(getStoredShoes()[0].currentMiles).toBe(100);

      // Valid miles added
      addMilesToShoe('test_shoe_1', 5.5);
      expect(getStoredShoes()[0].currentMiles).toBe(105.5);
    });

    it('getShoeHealth calculates correct status thresholds and clamps percentage', () => {
      // Good health (<60%)
      const good = getShoeHealth(100, RETIREMENT_THRESHOLD_MILES);
      expect(good.status).toBe('good');
      expect(good.remainingMiles).toBe(250);

      // Moderate health (60% - 84%)
      const moderate = getShoeHealth(220, RETIREMENT_THRESHOLD_MILES);
      expect(moderate.status).toBe('moderate');
      expect(moderate.remainingMiles).toBe(130);

      // Warning health (85% - 99%)
      const warning = getShoeHealth(310, RETIREMENT_THRESHOLD_MILES);
      expect(warning.status).toBe('warning');
      expect(warning.remainingMiles).toBe(40);

      // Retired (>= 350 miles)
      const retired = getShoeHealth(355, RETIREMENT_THRESHOLD_MILES);
      expect(retired.status).toBe('retired');
      expect(retired.percentage).toBe(100);
      expect(retired.remainingMiles).toBe(0);

      // Negative miles handled gracefully (clamped to 0)
      const negative = getShoeHealth(-20, RETIREMENT_THRESHOLD_MILES);
      expect(negative.status).toBe('good');
      expect(negative.percentage).toBe(0);
      expect(negative.remainingMiles).toBe(350);
    });
  });

  describe('Exercise Library Search & Progressive Overload Guardrails', () => {
    it('searchExercises filters accurately by text query and categories', () => {
      const all = getAllExercises();
      expect(all.length).toBeGreaterThan(0);

      const benchResults = searchExercises('bench', 'Chest');
      expect(benchResults.length).toBeGreaterThan(0);
      benchResults.forEach((ex) => {
        expect(ex.muscleGroup.toLowerCase()).toBe('chest');
        expect(ex.name.toLowerCase()).toContain('bench');
      });

      const nonexistent = searchExercises('nonexistent_exercise_xyz');
      expect(nonexistent).toEqual([]);
    });

    it('extractProgressiveOverloadHistory extracts only completed sets from newest sessions', () => {
      const sessions = [
        {
          date: '2026-11-01',
          exercises: [
            {
              exerciseName: 'Barbell Bench Press',
              sets: [
                { weightLbs: 220, reps: 8, completed: true },
                { weightLbs: 220, reps: 7, completed: true },
              ],
            },
          ],
        },
        {
          date: '2026-11-04', // newer session
          exercises: [
            {
              exerciseName: 'Barbell Bench Press',
              sets: [
                { weightLbs: 225, reps: 8, rir: 2, completed: true },
                { weightLbs: 225, reps: 8, rir: 1, completed: true },
                { weightLbs: 225, reps: 6, rir: 0, completed: false }, // ignored
              ],
            },
          ],
        },
      ];

      const history = extractProgressiveOverloadHistory(sessions);
      const benchHistory = history['Barbell Bench Press'];

      expect(benchHistory).toBeDefined();
      // Should extract from 2026-11-04 session, omitting the incomplete set
      expect(benchHistory).toHaveLength(2);
      expect(benchHistory[0].weightLbs).toBe(225);
      expect(benchHistory[0].reps).toBe(8);
      expect(benchHistory[0].rir).toBe(2);
    });

    it('extractProgressiveOverloadHistory returns empty object for null or empty input', () => {
      expect(extractProgressiveOverloadHistory([])).toEqual({});
      expect(extractProgressiveOverloadHistory(null)).toEqual({});
      expect(extractProgressiveOverloadHistory(undefined)).toEqual({});
    });
  });
});
