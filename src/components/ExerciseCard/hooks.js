import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  getExerciseMeta,
  isUnilateralExercise,
  isDualImplementExercise,
  isBandExercise,
  getExerciseCues,
} from '../../services/exerciseLibrary';

export const RIR_OPTIONS = [0, 1, 2, 3, 4];
export const EXERCISE_REST_PRESETS = [45, 60, 90, 120, 180, 240];

/**
 * Checks whether an exercise is typically performed with a standard barbell.
 * Properly excludes dumbbells, kettlebells, cables, machines, and bands (e.g., Goblet Squats, DB RDLs).
 */
export const isBarbellExercise = (exerciseName) => {
  if (!exerciseName) return false;
  const meta = getExerciseMeta(exerciseName);
  if (meta?.equipment) {
    return meta.equipment === 'Barbell';
  }

  const lower = exerciseName.toLowerCase();

  // Exclude non-barbell equipment and unilateral/free-weight movements
  if (
    lower.includes('dumbbell') ||
    lower.includes('db ') ||
    lower.includes(' db') ||
    lower.includes('kettlebell') ||
    lower.includes('kb ') ||
    lower.includes('goblet') ||
    lower.includes('bulgarian') ||
    lower.includes('split squat') ||
    lower.includes('cable') ||
    lower.includes('machine') ||
    lower.includes('band') ||
    lower.includes('bodyweight') ||
    lower.includes('push-up') ||
    lower.includes('pull-up') ||
    lower.includes('chin-up') ||
    lower.includes('dips')
  ) {
    return false;
  }

  return (
    lower.includes('barbell') ||
    lower.includes('bb ') ||
    lower.includes('ez-bar') ||
    lower.includes('bench press') ||
    lower.includes('back squat') ||
    lower.includes('front squat') ||
    lower.includes('zercher') ||
    lower.includes('deadlift') ||
    lower.includes('overhead press')
  );
};

export const useComponentLogic = ({
  exercise,
  previousHistory = [],
  onUpdateExerciseRest,
  onUpdateSet,
  onToggleCompleteSet,
  onAddSet,
  onRemoveSet,
  onRemoveExercise,
}) => {
  // Track which completed sets are currently in edit mode
  const [editingSets, setEditingSets] = useState({});

  // Slide-down drawer state for last session history
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Safe Deletion: which set has its 3-dot dropdown popover open
  const [openMenuSetId, setOpenMenuSetId] = useState(null);

  // Safe Deletion: which set is swiped-left revealing the red trash button
  const [swipedSetId, setSwipedSetId] = useState(null);
  const touchCoordsRef = useRef({ startX: 0, startY: 0 });

  // Close open popovers on outside click or Escape key
  useEffect(() => {
    if (!openMenuSetId && !swipedSetId) return;

    const handleDocumentClick = (e) => {
      if (
        !e.target.closest('.set-popover-menu') &&
        !e.target.closest('.set-menu-btn') &&
        !e.target.closest('.set-row-swipe-delete-btn')
      ) {
        setOpenMenuSetId(null);
        setSwipedSetId(null);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpenMenuSetId(null);
        setSwipedSetId(null);
      }
    };

    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenuSetId, swipedSetId]);

  const handleToggleSetMenu = useCallback((setId) => {
    setOpenMenuSetId((prev) => (prev === setId ? null : setId));
    setSwipedSetId(null);
  }, []);

  const handleCloseAllMenus = useCallback(() => {
    setOpenMenuSetId(null);
    setSwipedSetId(null);
  }, []);

  const handleTouchStart = (e) => {
    if (e.touches && e.touches[0]) {
      touchCoordsRef.current.startX = e.touches[0].clientX;
      touchCoordsRef.current.startY = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e, setId) => {
    if (!e.changedTouches || !e.changedTouches[0]) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - touchCoordsRef.current.startX;
    const deltaY = endY - touchCoordsRef.current.startY;

    // Horizontal swipe threshold: at least 40px left
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 40) {
      if (deltaX < -40) {
        // Swiped left -> reveal trash
        setSwipedSetId(setId);
        setOpenMenuSetId(null);
      } else if (deltaX > 40) {
        // Swiped right -> close
        if (swipedSetId === setId) {
          setSwipedSetId(null);
        }
      }
    }
  };

  // Plate Calculator Modal state
  const [plateCalcState, setPlateCalcState] = useState({
    isOpen: false,
    initialWeight: 135,
    targetSetId: null,
  });

  // Reusable Weight Picker Modal state (for dumbbells, cables, machines, bands)
  const [weightPickerState, setWeightPickerState] = useState({
    isOpen: false,
    defaultValue: 25,
    bandLevel: null,
    targetSetId: null,
  });

  const handleToggleHistory = () => {
    setIsHistoryOpen((prev) => !prev);
  };

  const handleStartEdit = (setId) => {
    setEditingSets((prev) => ({ ...prev, [setId]: true }));
  };

  const handleSaveEdit = (setId) => {
    setEditingSets((prev) => ({ ...prev, [setId]: false }));
  };

  const handleDeleteSet = (setId, setObj, setIdx) => {
    setEditingSets((prev) => {
      const next = { ...prev };
      delete next[setId];
      return next;
    });
    setOpenMenuSetId(null);
    setSwipedSetId(null);
    if (onRemoveSet) {
      onRemoveSet(exercise.id, setId, setObj, setIdx);
    }
  };

  const handleCompleteClick = (set) => {
    onToggleCompleteSet(exercise.id, set.id);
  };

  const handleExerciseRestChange = (rawValue) => {
    if (!onUpdateExerciseRest) return;
    const numeric = Number(rawValue);
    if (!Number.isNaN(numeric) && numeric > 0) {
      onUpdateExerciseRest(exercise.id, numeric);
    }
  };

  const handleWeightChange = (setId, rawValue) => {
    if (typeof rawValue === 'string' && rawValue.includes('-')) return;
    const num = rawValue === '' ? '' : Math.max(0, Number(rawValue));
    onUpdateSet(exercise.id, setId, {
      weightLbs: num,
    });
  };

  const handleWeightBlur = (setId, rawValue) => {
    if (rawValue === '' || rawValue === null || rawValue === undefined) return;
    const num = Number(rawValue);
    if (!Number.isNaN(num)) {
      const rounded = Math.max(0, Math.round(num * 2) / 2);
      onUpdateSet(exercise.id, setId, {
        weightLbs: rounded,
      });
    }
  };

  const handleOpenPlateCalc = (weight, setId) => {
    const num = Number(weight);
    const fallback = exercise.targetWeightLbs ?? exercise.target_weight_lbs ?? 135;
    const initialWeight = Number.isFinite(num) && num > 0 ? num : Number(fallback) || 135;
    setPlateCalcState({
      isOpen: true,
      initialWeight,
      targetSetId: setId,
    });
  };

  const handleClosePlateCalc = () => {
    setPlateCalcState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleApplyPlateWeight = (calculatedWeight) => {
    if (plateCalcState.targetSetId) {
      handleWeightChange(plateCalcState.targetSetId, calculatedWeight);
    }
    handleClosePlateCalc();
  };

  const handleOpenWeightPicker = (weight, setId) => {
    const targetSet = exercise.sets?.find((s) => s.id === setId);
    const num = Number(weight);
    const fallback = exercise.targetWeightLbs ?? exercise.target_weight_lbs ?? null;
    let initialVal = '';
    if (Number.isFinite(num) && num > 0) {
      initialVal = num;
    } else if (weight !== '' && weight !== null && weight !== undefined && Number.isFinite(num)) {
      initialVal = num;
    } else if (fallback !== null && fallback !== undefined && fallback !== '') {
      initialVal = Number(fallback) || fallback;
    }

    const bandLevel =
      targetSet?.bandLevel ||
      targetSet?.band_level ||
      exercise.bandLevel ||
      exercise.band_level ||
      null;

    setWeightPickerState({
      isOpen: true,
      defaultValue: initialVal,
      bandLevel,
      targetSetId: setId,
    });
  };

  const handleCloseWeightPicker = () => {
    setWeightPickerState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleApplyWeightPicker = (chosenWeight, chosenBandLevel) => {
    if (weightPickerState.targetSetId) {
      const updates = { weightLbs: chosenWeight };
      if (chosenBandLevel) {
        updates.bandLevel = chosenBandLevel;
        updates.band_level = chosenBandLevel;
      }
      onUpdateSet(exercise.id, weightPickerState.targetSetId, updates);
    }
    handleCloseWeightPicker();
  };

  const handleRepsChange = (setId, rawValue) => {
    if (typeof rawValue === 'string' && rawValue.includes('-')) return;
    const num = rawValue === '' ? '' : Math.max(0, Math.floor(Number(rawValue)));
    onUpdateSet(exercise.id, setId, {
      reps: num,
    });
  };

  const handleRirChange = (setId, rawValue) => {
    onUpdateSet(exercise.id, setId, {
      rir: Number(rawValue),
    });
  };

  const handleAddSetClick = () => {
    onAddSet(exercise.id);
  };

  const handleRemoveSetClick = (setId, setObj, setIdx) => {
    handleDeleteSet(setId, setObj, setIdx);
  };

  const handleRemoveExerciseClick = () => {
    if (onRemoveExercise) {
      onRemoveExercise(exercise);
    }
  };

  const hasHistory = previousHistory.length > 0;
  const currentRestSec = Number(exercise.restDurationSec) || 90;
  const restOptions = useMemo(() => {
    return EXERCISE_REST_PRESETS.includes(currentRestSec)
      ? EXERCISE_REST_PRESETS
      : [...EXERCISE_REST_PRESETS, currentRestSec].sort((a, b) => a - b);
  }, [currentRestSec]);

  const isBarbell = useMemo(
    () => isBarbellExercise(exercise.exerciseName),
    [exercise.exerciseName]
  );

  const isUnilateral = useMemo(
    () => isUnilateralExercise(exercise.exerciseName),
    [exercise.exerciseName]
  );

  const isDualImplement = useMemo(
    () => isDualImplementExercise(exercise.exerciseName),
    [exercise.exerciseName]
  );

  const isBand = useMemo(
    () => isBandExercise(exercise.exerciseName),
    [exercise.exerciseName]
  );

  const exerciseCues = useMemo(
    () => exercise.cues || exercise.description || getExerciseCues(exercise.exerciseName),
    [exercise.cues, exercise.description, exercise.exerciseName]
  );

  const [isCuesOpen, setIsCuesOpen] = useState(false);
  const handleToggleCues = useCallback(() => {
    setIsCuesOpen((prev) => !prev);
  }, []);

  return {
    editingSets,
    isHistoryOpen,
    hasHistory,
    isBarbell,
    isUnilateral,
    isDualImplement,
    isBand,
    exerciseCues,
    isCuesOpen,
    handleToggleCues,
    openMenuSetId,
    swipedSetId,
    plateCalcState,
    handleOpenPlateCalc,
    handleClosePlateCalc,
    handleApplyPlateWeight,
    weightPickerState,
    handleOpenWeightPicker,
    handleCloseWeightPicker,
    handleApplyWeightPicker,
    rirOptions: RIR_OPTIONS,
    currentRestSec,
    restOptions,
    handleToggleHistory,
    handleStartEdit,
    handleSaveEdit,
    handleDeleteSet,
    handleToggleSetMenu,
    handleCloseAllMenus,
    handleTouchStart,
    handleTouchEnd,
    handleCompleteClick,
    handleExerciseRestChange,
    handleWeightChange,
    handleWeightBlur,
    handleRepsChange,
    handleRirChange,
    handleAddSetClick,
    handleRemoveSetClick,
    handleRemoveExerciseClick,
  };
}
