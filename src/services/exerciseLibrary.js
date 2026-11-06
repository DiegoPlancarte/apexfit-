/**
 * Standardized Exercise Library
 * Categorized by Muscle Group and Equipment Type to preserve data integrity
 * in Google Sheets and eliminate typos and naming inconsistencies.
 */

export const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Calves',
  'Core',
];

export const EQUIPMENT_TYPES = [
  'Barbell',
  'Dumbbell',
  'Cable',
  'Machine',
  'Bodyweight',
];

export const EXERCISE_LIBRARY = [
  // CHEST
  { id: 'barbell-bench-press', name: 'Barbell Bench Press', muscleGroup: 'Chest', equipment: 'Barbell' },
  { id: 'incline-barbell-bench-press', name: 'Incline Barbell Bench Press', muscleGroup: 'Chest', equipment: 'Barbell' },
  { id: 'decline-barbell-bench-press', name: 'Decline Barbell Bench Press', muscleGroup: 'Chest', equipment: 'Barbell' },
  { id: 'close-grip-bench-press', name: 'Close-Grip Barbell Bench Press', muscleGroup: 'Chest', equipment: 'Barbell' },
  { id: 'flat-dumbbell-press', name: 'Flat Dumbbell Press', muscleGroup: 'Chest', equipment: 'Dumbbell' },
  { id: 'incline-dumbbell-press', name: 'Incline Dumbbell Press', muscleGroup: 'Chest', equipment: 'Dumbbell' },
  { id: 'decline-dumbbell-press', name: 'Decline Dumbbell Press', muscleGroup: 'Chest', equipment: 'Dumbbell' },
  { id: 'dumbbell-flye', name: 'Dumbbell Chest Flye', muscleGroup: 'Chest', equipment: 'Dumbbell' },
  { id: 'incline-dumbbell-flye', name: 'Incline Dumbbell Flye', muscleGroup: 'Chest', equipment: 'Dumbbell' },
  { id: 'cable-crossover', name: 'Cable Crossover', muscleGroup: 'Chest', equipment: 'Cable' },
  { id: 'low-to-high-cable-flye', name: 'Low-to-High Cable Flye', muscleGroup: 'Chest', equipment: 'Cable' },
  { id: 'high-to-low-cable-flye', name: 'High-to-Low Cable Flye', muscleGroup: 'Chest', equipment: 'Cable' },
  { id: 'standing-cable-press', name: 'Standing Cable Chest Press', muscleGroup: 'Chest', equipment: 'Cable' },
  { id: 'machine-chest-press', name: 'Machine Chest Press', muscleGroup: 'Chest', equipment: 'Machine' },
  { id: 'incline-machine-press', name: 'Incline Machine Press', muscleGroup: 'Chest', equipment: 'Machine' },
  { id: 'pec-deck-flye', name: 'Pec Deck Machine Flye', muscleGroup: 'Chest', equipment: 'Machine' },
  { id: 'push-up', name: 'Push-Up', muscleGroup: 'Chest', equipment: 'Bodyweight' },
  { id: 'chest-dips', name: 'Chest Dips', muscleGroup: 'Chest', equipment: 'Bodyweight' },
  { id: 'deficit-push-up', name: 'Deficit Push-Up', muscleGroup: 'Chest', equipment: 'Bodyweight' },

  // BACK
  { id: 'barbell-deadlift', name: 'Barbell Deadlift', muscleGroup: 'Back', equipment: 'Barbell' },
  { id: 'barbell-bent-over-row', name: 'Barbell Bent-Over Row', muscleGroup: 'Back', equipment: 'Barbell' },
  { id: 'pendlay-row', name: 'Pendlay Barbell Row', muscleGroup: 'Back', equipment: 'Barbell' },
  { id: 't-bar-row', name: 'T-Bar Row', muscleGroup: 'Back', equipment: 'Barbell' },
  { id: 'barbell-shrug', name: 'Barbell Shrug', muscleGroup: 'Back', equipment: 'Barbell' },
  { id: 'single-arm-dumbbell-row', name: 'Single-Arm Dumbbell Row', muscleGroup: 'Back', equipment: 'Dumbbell' },
  { id: 'chest-supported-dumbbell-row', name: 'Chest-Supported Dumbbell Row', muscleGroup: 'Back', equipment: 'Dumbbell' },
  { id: 'dumbbell-pullover', name: 'Dumbbell Pullover', muscleGroup: 'Back', equipment: 'Dumbbell' },
  { id: 'dumbbell-shrug', name: 'Dumbbell Shrug', muscleGroup: 'Back', equipment: 'Dumbbell' },
  { id: 'lat-pulldown', name: 'Lat Pulldown', muscleGroup: 'Back', equipment: 'Cable' },
  { id: 'neutral-grip-lat-pulldown', name: 'Neutral-Grip Lat Pulldown', muscleGroup: 'Back', equipment: 'Cable' },
  { id: 'seated-cable-row', name: 'Seated Cable Row', muscleGroup: 'Back', equipment: 'Cable' },
  { id: 'single-arm-cable-row', name: 'Single-Arm Cable Row', muscleGroup: 'Back', equipment: 'Cable' },
  { id: 'straight-arm-pulldown', name: 'Straight-Arm Cable Pulldown', muscleGroup: 'Back', equipment: 'Cable' },
  { id: 'face-pull', name: 'Cable Face Pull', muscleGroup: 'Back', equipment: 'Cable' },
  { id: 'machine-high-row', name: 'Machine High Row', muscleGroup: 'Back', equipment: 'Machine' },
  { id: 'machine-seated-row', name: 'Machine Seated Row', muscleGroup: 'Back', equipment: 'Machine' },
  { id: 'assisted-pull-up', name: 'Assisted Pull-Up Machine', muscleGroup: 'Back', equipment: 'Machine' },
  { id: 'pull-up', name: 'Pull-Up', muscleGroup: 'Back', equipment: 'Bodyweight' },
  { id: 'chin-up', name: 'Chin-Up', muscleGroup: 'Back', equipment: 'Bodyweight' },
  { id: 'inverted-row', name: 'Inverted Row', muscleGroup: 'Back', equipment: 'Bodyweight' },

  // QUADS
  { id: 'barbell-back-squat', name: 'Barbell Back Squat', muscleGroup: 'Quads', equipment: 'Barbell' },
  { id: 'barbell-front-squat', name: 'Barbell Front Squat', muscleGroup: 'Quads', equipment: 'Barbell' },
  { id: 'barbell-zercher-squat', name: 'Barbell Zercher Squat', muscleGroup: 'Quads', equipment: 'Barbell' },
  { id: 'barbell-walking-lunge', name: 'Barbell Walking Lunge', muscleGroup: 'Quads', equipment: 'Barbell' },
  { id: 'goblet-squat', name: 'Goblet Squat', muscleGroup: 'Quads', equipment: 'Dumbbell' },
  { id: 'dumbbell-bulgarian-split-squat', name: 'Dumbbell Bulgarian Split Squat', muscleGroup: 'Quads', equipment: 'Dumbbell' },
  { id: 'dumbbell-walking-lunge', name: 'Dumbbell Walking Lunge', muscleGroup: 'Quads', equipment: 'Dumbbell' },
  { id: 'dumbbell-step-up', name: 'Dumbbell Step-Up', muscleGroup: 'Quads', equipment: 'Dumbbell' },
  { id: 'cable-squat', name: 'Cable Squat', muscleGroup: 'Quads', equipment: 'Cable' },
  { id: 'leg-press', name: 'Leg Press', muscleGroup: 'Quads', equipment: 'Machine' },
  { id: 'hack-squat', name: 'Hack Squat', muscleGroup: 'Quads', equipment: 'Machine' },
  { id: 'leg-extension', name: 'Leg Extension', muscleGroup: 'Quads', equipment: 'Machine' },
  { id: 'pendulum-squat', name: 'Pendulum Squat', muscleGroup: 'Quads', equipment: 'Machine' },
  { id: 'smith-machine-squat', name: 'Smith Machine Squat', muscleGroup: 'Quads', equipment: 'Machine' },
  { id: 'bodyweight-squat', name: 'Bodyweight Squat', muscleGroup: 'Quads', equipment: 'Bodyweight' },
  { id: 'sissy-squat', name: 'Sissy Squat', muscleGroup: 'Quads', equipment: 'Bodyweight' },
  { id: 'pistol-squat', name: 'Pistol Squat', muscleGroup: 'Quads', equipment: 'Bodyweight' },

  // HAMSTRINGS
  { id: 'romanian-deadlift', name: 'Romanian Deadlift (RDL)', muscleGroup: 'Hamstrings', equipment: 'Barbell' },
  { id: 'barbell-stiff-leg-deadlift', name: 'Barbell Stiff-Leg Deadlift', muscleGroup: 'Hamstrings', equipment: 'Barbell' },
  { id: 'barbell-good-morning', name: 'Barbell Good Morning', muscleGroup: 'Hamstrings', equipment: 'Barbell' },
  { id: 'dumbbell-rdl', name: 'Dumbbell Romanian Deadlift', muscleGroup: 'Hamstrings', equipment: 'Dumbbell' },
  { id: 'single-leg-dumbbell-rdl', name: 'Single-Leg Dumbbell RDL', muscleGroup: 'Hamstrings', equipment: 'Dumbbell' },
  { id: 'cable-pull-through', name: 'Cable Pull-Through', muscleGroup: 'Hamstrings', equipment: 'Cable' },
  { id: 'seated-leg-curl', name: 'Seated Leg Curl', muscleGroup: 'Hamstrings', equipment: 'Machine' },
  { id: 'lying-leg-curl', name: 'Lying Leg Curl', muscleGroup: 'Hamstrings', equipment: 'Machine' },
  { id: 'glute-ham-raise', name: 'Glute-Ham Raise (GHR)', muscleGroup: 'Hamstrings', equipment: 'Machine' },
  { id: 'nordic-hamstring-curl', name: 'Nordic Hamstring Curl', muscleGroup: 'Hamstrings', equipment: 'Bodyweight' },

  // GLUTES
  { id: 'barbell-hip-thrust', name: 'Barbell Hip Thrust', muscleGroup: 'Glutes', equipment: 'Barbell' },
  { id: 'barbell-glute-bridge', name: 'Barbell Glute Bridge', muscleGroup: 'Glutes', equipment: 'Barbell' },
  { id: 'sumo-deadlift', name: 'Sumo Deadlift', muscleGroup: 'Glutes', equipment: 'Barbell' },
  { id: 'dumbbell-hip-thrust', name: 'Dumbbell Hip Thrust', muscleGroup: 'Glutes', equipment: 'Dumbbell' },
  { id: 'dumbbell-curtsy-lunge', name: 'Dumbbell Curtsy Lunge', muscleGroup: 'Glutes', equipment: 'Dumbbell' },
  { id: 'cable-glute-kickback', name: 'Cable Glute Kickback', muscleGroup: 'Glutes', equipment: 'Cable' },
  { id: 'cable-hip-abduction', name: 'Cable Hip Abduction', muscleGroup: 'Glutes', equipment: 'Cable' },
  { id: 'machine-hip-thrust', name: 'Machine Hip Thrust', muscleGroup: 'Glutes', equipment: 'Machine' },
  { id: 'seated-hip-abductor', name: 'Seated Hip Abductor Machine', muscleGroup: 'Glutes', equipment: 'Machine' },
  { id: 'bodyweight-glute-bridge', name: 'Bodyweight Glute Bridge', muscleGroup: 'Glutes', equipment: 'Bodyweight' },
  { id: 'frog-pump', name: 'Frog Pump', muscleGroup: 'Glutes', equipment: 'Bodyweight' },

  // SHOULDERS
  { id: 'overhead-press', name: 'Overhead Shoulder Press (OHP)', muscleGroup: 'Shoulders', equipment: 'Barbell' },
  { id: 'push-press', name: 'Barbell Push Press', muscleGroup: 'Shoulders', equipment: 'Barbell' },
  { id: 'barbell-upright-row', name: 'Barbell Upright Row', muscleGroup: 'Shoulders', equipment: 'Barbell' },
  { id: 'seated-dumbbell-shoulder-press', name: 'Seated Dumbbell Shoulder Press', muscleGroup: 'Shoulders', equipment: 'Dumbbell' },
  { id: 'arnold-press', name: 'Arnold Dumbbell Press', muscleGroup: 'Shoulders', equipment: 'Dumbbell' },
  { id: 'lateral-raise', name: 'Dumbbell Lateral Raise', muscleGroup: 'Shoulders', equipment: 'Dumbbell' },
  { id: 'dumbbell-front-raise', name: 'Dumbbell Front Raise', muscleGroup: 'Shoulders', equipment: 'Dumbbell' },
  { id: 'dumbbell-rear-delt-flye', name: 'Dumbbell Rear Delt Flye', muscleGroup: 'Shoulders', equipment: 'Dumbbell' },
  { id: 'cable-lateral-raise', name: 'Cable Lateral Raise', muscleGroup: 'Shoulders', equipment: 'Cable' },
  { id: 'behind-the-back-cable-lateral', name: 'Behind-the-Back Cable Lateral', muscleGroup: 'Shoulders', equipment: 'Cable' },
  { id: 'cable-front-raise', name: 'Cable Front Raise', muscleGroup: 'Shoulders', equipment: 'Cable' },
  { id: 'machine-shoulder-press', name: 'Machine Shoulder Press', muscleGroup: 'Shoulders', equipment: 'Machine' },
  { id: 'machine-lateral-raise', name: 'Machine Lateral Raise', muscleGroup: 'Shoulders', equipment: 'Machine' },
  { id: 'reverse-pec-deck', name: 'Reverse Pec Deck (Rear Delts)', muscleGroup: 'Shoulders', equipment: 'Machine' },
  { id: 'pike-push-up', name: 'Pike Push-Up', muscleGroup: 'Shoulders', equipment: 'Bodyweight' },
  { id: 'handstand-push-up', name: 'Handstand Push-Up', muscleGroup: 'Shoulders', equipment: 'Bodyweight' },

  // BICEPS
  { id: 'barbell-bicep-curl', name: 'Barbell Bicep Curl', muscleGroup: 'Biceps', equipment: 'Barbell' },
  { id: 'ez-bar-curl', name: 'EZ-Bar Curl', muscleGroup: 'Biceps', equipment: 'Barbell' },
  { id: 'barbell-preacher-curl', name: 'Barbell Preacher Curl', muscleGroup: 'Biceps', equipment: 'Barbell' },
  { id: 'reverse-barbell-curl', name: 'Reverse Grip Barbell Curl', muscleGroup: 'Biceps', equipment: 'Barbell' },
  { id: 'standing-dumbbell-curl', name: 'Standing Dumbbell Bicep Curl', muscleGroup: 'Biceps', equipment: 'Dumbbell' },
  { id: 'incline-dumbbell-curl', name: 'Incline Dumbbell Curl', muscleGroup: 'Biceps', equipment: 'Dumbbell' },
  { id: 'dumbbell-hammer-curl', name: 'Dumbbell Hammer Curl', muscleGroup: 'Biceps', equipment: 'Dumbbell' },
  { id: 'concentration-curl', name: 'Dumbbell Concentration Curl', muscleGroup: 'Biceps', equipment: 'Dumbbell' },
  { id: 'spider-curl', name: 'Dumbbell Spider Curl', muscleGroup: 'Biceps', equipment: 'Dumbbell' },
  { id: 'cable-bicep-curl', name: 'Cable Bicep Curl', muscleGroup: 'Biceps', equipment: 'Cable' },
  { id: 'cable-hammer-curl', name: 'Cable Rope Hammer Curl', muscleGroup: 'Biceps', equipment: 'Cable' },
  { id: 'behind-the-back-cable-curl', name: 'Behind-the-Back Cable Curl', muscleGroup: 'Biceps', equipment: 'Cable' },
  { id: 'machine-bicep-curl', name: 'Machine Bicep Curl', muscleGroup: 'Biceps', equipment: 'Machine' },
  { id: 'machine-preacher-curl', name: 'Machine Preacher Curl', muscleGroup: 'Biceps', equipment: 'Machine' },
  { id: 'underhand-chin-up', name: 'Underhand Chin-Up', muscleGroup: 'Biceps', equipment: 'Bodyweight' },

  // TRICEPS
  { id: 'barbell-skull-crusher', name: 'Barbell Skull Crusher', muscleGroup: 'Triceps', equipment: 'Barbell' },
  { id: 'close-grip-bench-triceps', name: 'Close-Grip Bench Press', muscleGroup: 'Triceps', equipment: 'Barbell' },
  { id: 'jm-press', name: 'JM Press', muscleGroup: 'Triceps', equipment: 'Barbell' },
  { id: 'dumbbell-overhead-extension', name: 'Dumbbell Overhead Tricep Extension', muscleGroup: 'Triceps', equipment: 'Dumbbell' },
  { id: 'dumbbell-skull-crusher', name: 'Dumbbell Skull Crusher', muscleGroup: 'Triceps', equipment: 'Dumbbell' },
  { id: 'dumbbell-kickback', name: 'Dumbbell Tricep Kickback', muscleGroup: 'Triceps', equipment: 'Dumbbell' },
  { id: 'tricep-rope-pushdown', name: 'Tricep Rope Pushdown', muscleGroup: 'Triceps', equipment: 'Cable' },
  { id: 'straight-bar-pushdown', name: 'Straight-Bar Cable Pushdown', muscleGroup: 'Triceps', equipment: 'Cable' },
  { id: 'cable-overhead-extension', name: 'Cable Overhead Tricep Extension', muscleGroup: 'Triceps', equipment: 'Cable' },
  { id: 'single-arm-cable-pushdown', name: 'Single-Arm Cable Pushdown', muscleGroup: 'Triceps', equipment: 'Cable' },
  { id: 'machine-tricep-dip', name: 'Machine Tricep Dip', muscleGroup: 'Triceps', equipment: 'Machine' },
  { id: 'machine-tricep-extension', name: 'Machine Tricep Extension', muscleGroup: 'Triceps', equipment: 'Machine' },
  { id: 'bodyweight-tricep-dips', name: 'Bodyweight Tricep Dips', muscleGroup: 'Triceps', equipment: 'Bodyweight' },
  { id: 'diamond-push-up', name: 'Diamond Push-Up', muscleGroup: 'Triceps', equipment: 'Bodyweight' },
  { id: 'bench-dips', name: 'Bench Dips', muscleGroup: 'Triceps', equipment: 'Bodyweight' },

  // CALVES
  { id: 'standing-barbell-calf-raise', name: 'Standing Barbell Calf Raise', muscleGroup: 'Calves', equipment: 'Barbell' },
  { id: 'single-leg-dumbbell-calf-raise', name: 'Single-Leg Dumbbell Calf Raise', muscleGroup: 'Calves', equipment: 'Dumbbell' },
  { id: 'seated-dumbbell-calf-raise', name: 'Seated Dumbbell Calf Raise', muscleGroup: 'Calves', equipment: 'Dumbbell' },
  { id: 'cable-standing-calf-raise', name: 'Cable Standing Calf Raise', muscleGroup: 'Calves', equipment: 'Cable' },
  { id: 'standing-machine-calf-raise', name: 'Standing Machine Calf Raise', muscleGroup: 'Calves', equipment: 'Machine' },
  { id: 'seated-machine-calf-raise', name: 'Seated Machine Calf Raise', muscleGroup: 'Calves', equipment: 'Machine' },
  { id: 'leg-press-calf-raise', name: 'Leg Press Calf Press', muscleGroup: 'Calves', equipment: 'Machine' },
  { id: 'bodyweight-calf-raise', name: 'Bodyweight Calf Raise', muscleGroup: 'Calves', equipment: 'Bodyweight' },

  // CORE
  { id: 'barbell-ab-rollout', name: 'Barbell Ab Rollout', muscleGroup: 'Core', equipment: 'Barbell' },
  { id: 'barbell-overhead-carry', name: 'Barbell Overhead Carry', muscleGroup: 'Core', equipment: 'Barbell' },
  { id: 'dumbbell-side-bend', name: 'Dumbbell Side Bend', muscleGroup: 'Core', equipment: 'Dumbbell' },
  { id: 'dumbbell-russian-twist', name: 'Dumbbell Russian Twist', muscleGroup: 'Core', equipment: 'Dumbbell' },
  { id: 'dumbbell-suitcase-carry', name: 'Dumbbell Suitcase Carry', muscleGroup: 'Core', equipment: 'Dumbbell' },
  { id: 'cable-woodchopper', name: 'Cable Woodchopper', muscleGroup: 'Core', equipment: 'Cable' },
  { id: 'cable-kneeling-crunch', name: 'Cable Kneeling Crunch', muscleGroup: 'Core', equipment: 'Cable' },
  { id: 'pallof-press', name: 'Cable Pallof Press', muscleGroup: 'Core', equipment: 'Cable' },
  { id: 'machine-ab-crunch', name: 'Machine Abdominal Crunch', muscleGroup: 'Core', equipment: 'Machine' },
  { id: 'captains-chair-leg-raise', name: "Captain's Chair Leg Raise", muscleGroup: 'Core', equipment: 'Machine' },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', muscleGroup: 'Core', equipment: 'Bodyweight' },
  { id: 'plank', name: 'Plank Hold', muscleGroup: 'Core', equipment: 'Bodyweight' },
  { id: 'ab-crunch', name: 'Abdominal Floor Crunch', muscleGroup: 'Core', equipment: 'Bodyweight' },
  { id: 'hollow-body-hold', name: 'Hollow Body Hold', muscleGroup: 'Core', equipment: 'Bodyweight' },
];

/**
 * Returns all standardized exercises in the library.
 */
export const getAllExercises = () => EXERCISE_LIBRARY;

/**
 * Returns list of muscle groups.
 */
export const getMuscleGroups = () => MUSCLE_GROUPS;

/**
 * Returns list of equipment types.
 */
export const getEquipmentTypes = () => EQUIPMENT_TYPES;

/**
 * Searches and filters the exercise library by query, muscle group, and equipment.
 *
 * @param {string} query - Free search query text
 * @param {string} muscleGroup - Muscle group filter or 'All'
 * @param {string} equipment - Equipment type filter or 'All'
 * @returns {Array} Filtered list of exercises
 */
export const searchExercises = (query = '', muscleGroup = 'All', equipment = 'All') => {
  const cleanQuery = query.trim().toLowerCase();

  return EXERCISE_LIBRARY.filter((ex) => {
    // Muscle group filter
    if (muscleGroup && muscleGroup !== 'All') {
      if (ex.muscleGroup.toLowerCase() !== muscleGroup.toLowerCase()) {
        return false;
      }
    }

    // Equipment filter
    if (equipment && equipment !== 'All') {
      if (ex.equipment.toLowerCase() !== equipment.toLowerCase()) {
        return false;
      }
    }

    // Search query text filter
    if (cleanQuery) {
      const nameMatch = ex.name.toLowerCase().includes(cleanQuery);
      const muscleMatch = ex.muscleGroup.toLowerCase().includes(cleanQuery);
      const equipMatch = ex.equipment.toLowerCase().includes(cleanQuery);
      return nameMatch || muscleMatch || equipMatch;
    }

    return true;
  });
}
