import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

export const QUICK_EXERCISES = [
  'Barbell Bench Press',
  'Incline Dumbbell Press',
  'Barbell Back Squat',
  'Romanian Deadlift',
  'Lat Pulldown',
  'Seated Cable Row',
  'Overhead Shoulder Press',
  'Lateral Raise',
];

export const useComponentLogic = ({
  workoutState,
  onUpdateWorkoutMeta,
  onAddExercise,
  onRemoveExercise,
  onResetWorkout,
  onRemoveSet,
  onRestoreSet,
}) => {
  const [newExerciseName, setNewExerciseName] = useState('');
  const [exercisePendingDelete, setExercisePendingDelete] = useState(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerInitialSearch, setPickerInitialSearch] = useState('');

  // Undo safety net for deleted sets
  const [undoToast, setUndoToast] = useState(null);
  const undoTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const handleRemoveSetWithUndo = useCallback(
    (exerciseId, setId, setData, setIndex) => {
      let targetSet = setData;
      let targetIndex = setIndex;
      const ex = workoutState.exercises.find((e) => e.id === exerciseId);
      if (ex) {
        if (!targetSet) {
          targetIndex = ex.sets.findIndex((s) => s.id === setId);
          targetSet = ex.sets[targetIndex];
        }
      }

      if (onRemoveSet) {
        onRemoveSet(exerciseId, setId);
      }

      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }

      if (targetSet) {
        setUndoToast({
          exerciseId,
          set: { ...targetSet },
          index: targetIndex,
          setNumber: targetSet.setNumber,
        });

        undoTimerRef.current = setTimeout(() => {
          setUndoToast(null);
        }, 4000);
      }
    },
    [workoutState.exercises, onRemoveSet]
  );

  const handleUndoDeleteSet = useCallback(() => {
    if (!undoToast) return;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    if (onRestoreSet) {
      onRestoreSet(undoToast.exerciseId, undoToast.set, undoToast.index);
    }
    setUndoToast(null);
  }, [undoToast, onRestoreSet]);

  const handleDismissUndoToast = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    setUndoToast(null);
  }, []);

  const handleOpenPicker = (initial = '') => {
    setPickerInitialSearch(initial || newExerciseName);
    setIsPickerOpen(true);
  };

  const handleClosePicker = () => {
    setIsPickerOpen(false);
    setPickerInitialSearch('');
  };

  const handleSelectExerciseFromLibrary = (exerciseName) => {
    if (onAddExercise && exerciseName) {
      onAddExercise(exerciseName);
      setNewExerciseName('');
    }
    setIsPickerOpen(false);
  };

  const handleAddExerciseSubmit = (e) => {
    e.preventDefault();
    const trimmed = newExerciseName.trim();
    if (!trimmed) {
      handleOpenPicker('');
      return;
    }
    onAddExercise(trimmed);
    setNewExerciseName('');
  };

  const handleWorkoutNameChange = (e) => {
    onUpdateWorkoutMeta({ workoutName: e.target.value });
  };

  const handleWorkoutNotesChange = (e) => {
    onUpdateWorkoutMeta({ notes: e.target.value });
  };

  const handleQuickAddExercise = (name) => {
    onAddExercise(name);
  };

  const handleRequestDeleteExercise = (exercise) => {
    setExercisePendingDelete(exercise);
  };

  const handleConfirmDeleteExercise = () => {
    if (exercisePendingDelete && onRemoveExercise) {
      onRemoveExercise(exercisePendingDelete.id);
    }
    setExercisePendingDelete(null);
  };

  const handleCancelDeleteExercise = () => {
    setExercisePendingDelete(null);
  };

  const handleRequestReset = () => {
    setIsResetModalOpen(true);
  };

  const handleConfirmReset = () => {
    if (onResetWorkout) {
      onResetWorkout();
    }
    setIsResetModalOpen(false);
  };

  const handleCancelReset = () => {
    setIsResetModalOpen(false);
  };

  const { allSets, completedSets, totalVolumeLbs } = useMemo(() => {
    const flatSets = (workoutState.exercises || []).flatMap((ex) => ex.sets || []);
    const done = flatSets.filter((s) => s.completed);
    const volume = done.reduce(
      (sum, s) => sum + (Number(s.weightLbs) || 0) * (Number(s.reps) || 0),
      0
    );
    return { allSets: flatSets, completedSets: done, totalVolumeLbs: volume };
  }, [workoutState.exercises]);

  return {
    newExerciseName,
    setNewExerciseName,
    quickExercises: QUICK_EXERCISES,
    exercisePendingDelete,
    isResetModalOpen,
    isPickerOpen,
    pickerInitialSearch,
    undoToast,
    totalExercisesCount: workoutState.exercises.length,
    totalSetsCount: allSets.length,
    completedSetsCount: completedSets.length,
    totalVolumeLbs,
    handleOpenPicker,
    handleClosePicker,
    handleSelectExerciseFromLibrary,
    handleRemoveSetWithUndo,
    handleUndoDeleteSet,
    handleDismissUndoToast,
    handleAddExerciseSubmit,
    handleWorkoutNameChange,
    handleWorkoutNotesChange,
    handleQuickAddExercise,
    handleRequestDeleteExercise,
    handleConfirmDeleteExercise,
    handleCancelDeleteExercise,
    handleRequestReset,
    handleConfirmReset,
    handleCancelReset,
  };
}
