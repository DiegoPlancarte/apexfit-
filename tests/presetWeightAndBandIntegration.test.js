import { getResistanceBand } from '../src/services/exerciseLibrary';
import { normalizePlanItem } from '../src/services/api';
import {
  detectEquipmentType,
  roundToHalf,
} from '../src/components/WeightPickerModal/hooks';

describe('Frontend Exercise Preset Weight & Band Integration', () => {
  describe('1. HB-AB01 Resistance Band Specifications & Matching (getResistanceBand)', () => {
    it('accurately resolves bands by level name with hyphen and casing tolerance', () => {
      expect(getResistanceBand('X-Light')?.id).toBe('hb-ab01-xlight');
      expect(getResistanceBand('xlight')?.id).toBe('hb-ab01-xlight');
      expect(getResistanceBand('x-light')?.id).toBe('hb-ab01-xlight');
      expect(getResistanceBand('Light')?.id).toBe('hb-ab01-light');
      expect(getResistanceBand('light')?.id).toBe('hb-ab01-light');
      expect(getResistanceBand('Medium')?.id).toBe('hb-ab01-medium');
      expect(getResistanceBand('Heavy')?.id).toBe('hb-ab01-heavy');
      expect(getResistanceBand('X-Heavy')?.id).toBe('hb-ab01-xheavy');
      expect(getResistanceBand('xheavy')?.id).toBe('hb-ab01-xheavy');
    });

    it('resolves bands by color identifier', () => {
      expect(getResistanceBand('Yellow')?.level).toBe('X-Light');
      expect(getResistanceBand('yellow')?.avgTension).toBe(17.5);
      expect(getResistanceBand('Red')?.level).toBe('Light');
      expect(getResistanceBand('red')?.avgTension).toBe(37.5);
      expect(getResistanceBand('Black')?.level).toBe('Medium');
      expect(getResistanceBand('black')?.avgTension).toBe(72.5);
      expect(getResistanceBand('Purple')?.level).toBe('Heavy');
      expect(getResistanceBand('purple')?.avgTension).toBe(92.5);
      expect(getResistanceBand('Green')?.level).toBe('X-Heavy');
      expect(getResistanceBand('green')?.avgTension).toBe(115);
    });

    it('resolves bands by exact ID or tension values', () => {
      expect(getResistanceBand('hb-ab01-light')?.level).toBe('Light');
      expect(getResistanceBand(37.5)?.level).toBe('Light');
      expect(getResistanceBand(17.5)?.level).toBe('X-Light');
      expect(getResistanceBand(72.5)?.level).toBe('Medium');
    });

    it('returns null for empty, unknown, or invalid identifiers', () => {
      expect(getResistanceBand('')).toBeNull();
      expect(getResistanceBand(null)).toBeNull();
      expect(getResistanceBand(undefined)).toBeNull();
      expect(getResistanceBand('Titanium Super Band')).toBeNull();
    });
  });

  describe('2. Preset Weight & Band Ingestion from Exercises_JSON (normalizePlanItem)', () => {
    it('ingests target_weight_lbs for dumbbells and kettlebells without defaulting to blank', () => {
      const planItem = {
        Day_Number: 1,
        Workout_Title: 'Lower Body Strength',
        Exercises_JSON: JSON.stringify([
          {
            exercise: 'Romanian Deadlift (Dumbbell)',
            target_sets: 3,
            target_reps: '10-12',
            target_weight_lbs: 35,
            target_rir: 3,
            rest_sec: 90,
          },
          {
            exercise: 'Goblet Squat',
            target_sets: 3,
            target_reps: '12',
            target_weight_lbs: 50,
            target_rir: 2,
            rest_sec: 75,
          },
        ]),
      };

      const normalized = normalizePlanItem(planItem);
      expect(normalized.exerciseTargets).toHaveLength(2);

      // Dumbbell RDL
      const dbRdl = normalized.exerciseTargets[0];
      expect(dbRdl.exercise).toBe('Romanian Deadlift (Dumbbell)');
      expect(dbRdl.target_weight_lbs).toBe(35);
      expect(dbRdl.targetWeightLbs).toBe(35);

      // Goblet Squat
      const goblet = normalized.exerciseTargets[1];
      expect(goblet.exercise).toBe('Goblet Squat');
      expect(goblet.target_weight_lbs).toBe(50);
      expect(goblet.targetWeightLbs).toBe(50);
    });

    it('ingests band_level for resistance band movements and pre-fills calibrated tension', () => {
      const planItem = {
        Day_Number: 2,
        Workout_Title: 'Upper Accessory & Bands',
        Exercises_JSON: JSON.stringify([
          {
            exercise: 'Resistance Band Pull-Apart',
            target_sets: 3,
            target_reps: '15',
            band_level: 'Light',
            target_rir: 2,
            rest_sec: 60,
          },
          {
            exercise: 'Banded Face Pull',
            target_sets: 3,
            target_reps: '15',
            band_level: 'Red', // color synonym for Light (HB-AB01 Red: 15–60 lbs)
            target_rir: 2,
            rest_sec: 60,
          },
          {
            exercise: 'Banded Good Morning',
            target_sets: 3,
            target_reps: '12',
            band_level: 'Heavy',
            target_weight_lbs: 90, // explicit tension override
            target_rir: 3,
            rest_sec: 90,
          },
        ]),
      };

      const normalized = normalizePlanItem(planItem);
      expect(normalized.exerciseTargets).toHaveLength(3);

      // Light Band (auto-filled with 37.5 lb mid-tension)
      const pullApart = normalized.exerciseTargets[0];
      expect(pullApart.exercise).toBe('Resistance Band Pull-Apart');
      expect(pullApart.band_level).toBe('Light');
      expect(pullApart.bandLevel).toBe('Light');
      expect(pullApart.target_weight_lbs).toBe(37.5);

      // Band Face Pull with color 'Red' (harmonized to Light, 37.5 lbs)
      const facePull = normalized.exerciseTargets[1];
      expect(facePull.band_level).toBe('Light');
      expect(facePull.bandLevel).toBe('Light');
      expect(facePull.target_weight_lbs).toBe(37.5);

      // Band Good Morning with explicit target_weight_lbs
      const goodMorning = normalized.exerciseTargets[2];
      expect(goodMorning.band_level).toBe('Heavy');
      expect(goodMorning.target_weight_lbs).toBe(90);
    });
  });

  describe('3. Workout Screen Pre-filling Simulation for Presets & Bands', () => {
    it('populates initial sets with programmed target weights rather than defaulting to 0 or blank', () => {
      const planItem = normalizePlanItem({
        Day_Number: 1,
        Workout_Title: 'Strength B (Free Weight & Bands)',
        Exercises_JSON: JSON.stringify([
          {
            exercise: 'Romanian Deadlift (Dumbbell)',
            target_sets: 3,
            target_reps: '10-12',
            target_weight_lbs: 35,
            target_rir: 3,
            rest_sec: 90,
          },
          {
            exercise: 'Resistance Band Pull-Apart',
            target_sets: 3,
            target_reps: '15',
            band_level: 'Light',
            target_rir: 2,
            rest_sec: 60,
          },
        ]),
      });

      // Emulate handleSelectWorkoutDay exercise creation
      const loadedExercises = planItem.exerciseTargets.map((targetConfig, idx) => {
        const exerciseName = targetConfig.exercise;
        const resolvedPresetWeight = targetConfig.target_weight_lbs;
        const resolvedBandLevel = targetConfig.band_level;
        const setsCount = targetConfig.target_sets || 3;

        return {
          id: `ex_${idx}`,
          exerciseName,
          targetWeightLbs: resolvedPresetWeight,
          bandLevel: resolvedBandLevel,
          sets: Array.from({ length: setsCount }, (_, sIdx) => ({
            id: `set_${idx}_${sIdx + 1}`,
            setNumber: sIdx + 1,
            // When target weight is programmed, it must not be 0 or blank!
            weightLbs: resolvedPresetWeight !== undefined && resolvedPresetWeight !== null
              ? resolvedPresetWeight
              : '',
            bandLevel: resolvedBandLevel || null,
          })),
        };
      });

      // Dumbbell RDL Verification
      const rdl = loadedExercises[0];
      expect(rdl.targetWeightLbs).toBe(35);
      expect(rdl.sets).toHaveLength(3);
      rdl.sets.forEach((set) => {
        expect(set.weightLbs).toBe(35);
        expect(set.weightLbs).not.toBe('');
        expect(set.weightLbs).not.toBe(0);
      });

      // Resistance Band Pull-Apart Verification
      const bandEx = loadedExercises[1];
      expect(bandEx.bandLevel).toBe('Light');
      expect(bandEx.targetWeightLbs).toBe(37.5);
      expect(bandEx.sets).toHaveLength(3);
      bandEx.sets.forEach((set) => {
        expect(set.weightLbs).toBe(37.5);
        expect(set.bandLevel).toBe('Light');
        expect(set.weightLbs).not.toBe('');
        expect(set.weightLbs).not.toBe(0);
      });
    });
  });

  describe('4. Equipment Category Detection & Formatting Guards', () => {
    it('correctly categorizes exercises for appropriate adjuster modal routing', () => {
      expect(detectEquipmentType('Romanian Deadlift (Dumbbell)')).toBe('dumbbell');
      expect(detectEquipmentType('Goblet Squat')).toBe('dumbbell');
      expect(detectEquipmentType('Kettlebell Swing')).toBe('kettlebell');
      expect(detectEquipmentType('Resistance Band Pull-Apart')).toBe('band');
      expect(detectEquipmentType('Banded Monster Walk')).toBe('band');
      expect(detectEquipmentType('Cable Face Pull')).toBe('cable');
      expect(detectEquipmentType('Leg Extension Machine')).toBe('machine');
    });

    it('roundToHalf handles 0.5 lb increment rounding cleanly', () => {
      expect(roundToHalf(37.5)).toBe(37.5);
      expect(roundToHalf(37.4)).toBe(37.5);
      expect(roundToHalf(37.2)).toBe(37);
      expect(roundToHalf('52.5')).toBe(52.5);
      expect(roundToHalf('')).toBe('');
    });
  });
});
