import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  MUSCLE_GROUPS,
  EQUIPMENT_TYPES,
  searchExercises,
} from '../../services/exerciseLibrary';

/**
 * Custom hook managing ExercisePickerModal search, filters, and custom additions.
 */
export const useComponentLogic = ({
  isOpen,
  onClose,
  onSelectExercise,
  initialSearch = '',
}) => {
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedMuscle, setSelectedMuscle] = useState('All');
  const [selectedEquipment, setSelectedEquipment] = useState('All');

  // Track initialSearch prop changes
  const [prevInitialSearch, setPrevInitialSearch] = useState(initialSearch);
  if (initialSearch !== prevInitialSearch) {
    setPrevInitialSearch(initialSearch);
    setSearchQuery(initialSearch);
  }

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filtered exercise list
  const filteredExercises = useMemo(() => {
    return searchExercises(searchQuery, selectedMuscle, selectedEquipment);
  }, [searchQuery, selectedMuscle, selectedEquipment]);

  // Check if current search query matches an existing exercise in the full library exactly
  const isExactMatch = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return true;
    return filteredExercises.some((ex) => ex.name.toLowerCase() === trimmed);
  }, [searchQuery, filteredExercises]);

  const handleSelect = useCallback(
    (exerciseName) => {
      if (onSelectExercise) {
        onSelectExercise(exerciseName);
      }
      onClose?.();
    },
    [onSelectExercise, onClose]
  );

  const handleAddCustom = useCallback(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    if (onSelectExercise) {
      onSelectExercise(trimmed);
    }
    setSearchQuery('');
    onClose?.();
  }, [searchQuery, onSelectExercise, onClose]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const handleResetFilters = useCallback(() => {
    setSelectedMuscle('All');
    setSelectedEquipment('All');
    setSearchQuery('');
  }, []);

  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        onClose?.();
      }
    },
    [onClose]
  );

  return {
    searchQuery,
    setSearchQuery,
    selectedMuscle,
    setSelectedMuscle,
    selectedEquipment,
    setSelectedEquipment,
    muscleGroups: ['All', ...MUSCLE_GROUPS],
    equipmentTypes: ['All', ...EQUIPMENT_TYPES],
    filteredExercises,
    isExactMatch,
    handleSelect,
    handleAddCustom,
    handleClearSearch,
    handleResetFilters,
    handleBackdropClick,
  };
}
