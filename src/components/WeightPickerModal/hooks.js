import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  RESISTANCE_BANDS,
  getResistanceBand,
  getExerciseMeta,
  isDualImplementExercise,
  isUnilateralExercise,
} from '../../services/exerciseLibrary';

export const DUMBBELL_PRESETS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100];
export const KETTLEBELL_PRESETS = [9, 13, 18, 26, 35, 44, 53, 62, 70, 80];
export const CABLE_PRESETS = [10, 20, 30, 40, 50, 60, 70, 85, 100, 120, 140, 160];
export const MACHINE_PRESETS = [30, 50, 70, 90, 110, 130, 150, 170, 190, 210, 230, 250];
export const GENERAL_PRESETS = [15, 25, 35, 45, 55, 65, 75, 90, 105, 120, 140, 160];

/**
 * Rounds a number or string to the nearest 0.5 lb increment.
 *
 * @param {number|string} value
 * @returns {number|string}
 */
export const roundToHalf = (value) => {
  if (value === '' || value === null || value === undefined) return '';
  const num = Number(value);
  if (Number.isNaN(num)) return '';
  return Math.round(num * 2) / 2;
};

/**
 * Detects the equipment category from the exercise name.
 * Correctly distinguishes dumbbells, kettlebells, resistance bands, cables, and machines.
 *
 * @param {string} exerciseName
 * @returns {'dumbbell'|'kettlebell'|'band'|'cable'|'machine'|'general'}
 */
export const detectEquipmentType = (exerciseName = '') => {
  const meta = getExerciseMeta(exerciseName);
  if (meta?.equipment) {
    const eq = meta.equipment.toLowerCase();
    if (eq === 'band') return 'band';
    if (eq === 'kettlebell') return 'kettlebell';
    if (eq === 'dumbbell') return 'dumbbell';
    if (eq === 'cable') return 'cable';
    if (eq === 'machine') return 'machine';
  }

  const lower = exerciseName.toLowerCase();
  if (lower.includes('band') || lower.includes('loop')) {
    return 'band';
  }
  if (lower.includes('kettlebell') || lower.includes('kb ') || lower.includes(' kb')) {
    return 'kettlebell';
  }
  if (
    lower.includes('dumbbell') ||
    lower.includes('db ') ||
    lower.includes(' db') ||
    lower.includes('goblet') ||
    lower.includes('bulgarian') ||
    lower.includes('split squat') ||
    lower.includes('lateral raise') ||
    lower.includes('curl') ||
    lower.includes('arnold')
  ) {
    return 'dumbbell';
  }
  if (
    lower.includes('cable') ||
    lower.includes('pulldown') ||
    lower.includes('pushdown') ||
    lower.includes('face pull') ||
    lower.includes('crossover')
  ) {
    return 'cable';
  }
  if (
    lower.includes('machine') ||
    lower.includes('leg press') ||
    lower.includes('extension') ||
    lower.includes('hack') ||
    lower.includes('smith') ||
    lower.includes('pec deck')
  ) {
    return 'machine';
  }
  return 'general';
};

/**
 * Hook managing the interactive weight stepper, direct input, and preset selection logic.
 */
export const useComponentLogic = ({
  isOpen,
  onClose,
  onApplyWeight,
  defaultValue = '',
  minValue = 0,
  maxValue = 500,
  stepValue = 5,
  exerciseName = '',
  bandLevel = null,
}) => {
  const equipmentType = useMemo(() => detectEquipmentType(exerciseName), [exerciseName]);

  const resolveInitialBand = useCallback(() => {
    if (equipmentType !== 'band') return null;
    return (
      getResistanceBand(bandLevel) ||
      getResistanceBand(defaultValue) ||
      RESISTANCE_BANDS[2]
    );
  }, [equipmentType, bandLevel, defaultValue]);

  const resolveInitialWeightInput = useCallback(() => {
    const num = Number(defaultValue);
    if (Number.isFinite(num) && num > 0) {
      return String(num);
    }
    if (equipmentType === 'band') {
      const b = resolveInitialBand();
      if (b) return String(b.avgTension);
    }
    return defaultValue !== '' && defaultValue !== null && defaultValue !== undefined && !Number.isNaN(num)
      ? String(num)
      : '25';
  }, [defaultValue, equipmentType, resolveInitialBand]);

  const [weightInput, setWeightInput] = useState(resolveInitialWeightInput);
  const [selectedBand, setSelectedBand] = useState(resolveInitialBand);

  // Sync state when props change
  const [prevDefault, setPrevDefault] = useState(defaultValue);
  const [prevBandLevel, setPrevBandLevel] = useState(bandLevel);

  if (defaultValue !== prevDefault || bandLevel !== prevBandLevel) {
    setPrevDefault(defaultValue);
    setPrevBandLevel(bandLevel);
    const newBand = resolveInitialBand();
    setSelectedBand(newBand);
    const num = Number(defaultValue);
    if (Number.isFinite(num) && num > 0) {
      setWeightInput(String(num));
    } else if (equipmentType === 'band' && newBand) {
      setWeightInput(String(newBand.avgTension));
    } else if (defaultValue !== '' && defaultValue !== null && defaultValue !== undefined && !Number.isNaN(num)) {
      setWeightInput(String(num));
    } else {
      setWeightInput('25');
    }
  }

  // Active step size (e.g. 2.5 or 5)
  const [activeStep, setActiveStep] = useState(stepValue || 5);

  const isDual = useMemo(() => isDualImplementExercise(exerciseName), [exerciseName]);
  const isUnilat = useMemo(() => isUnilateralExercise(exerciseName), [exerciseName]);

  const equipmentSubLabel = useMemo(() => {
    if (equipmentType === 'dumbbell') {
      if (isDual) return 'per hand (dual DBs)';
      if (isUnilat) return 'per side';
      return 'per hand';
    }
    if (equipmentType === 'kettlebell') {
      return isUnilat ? 'per side' : 'per kettlebell';
    }
    if (equipmentType === 'band') {
      return 'calibrated tension (HB-AB01)';
    }
    if (equipmentType === 'cable' || equipmentType === 'machine') {
      return 'total stack';
    }
    return 'total load';
  }, [equipmentType, isDual, isUnilat]);

  const presetList = useMemo(() => {
    switch (equipmentType) {
      case 'dumbbell':
        return DUMBBELL_PRESETS;
      case 'kettlebell':
        return KETTLEBELL_PRESETS;
      case 'cable':
        return CABLE_PRESETS;
      case 'machine':
        return MACHINE_PRESETS;
      default:
        return GENERAL_PRESETS;
    }
  }, [equipmentType]);

  const handleSelectBand = useCallback((band) => {
    setSelectedBand(band);
    setWeightInput(String(band.avgTension));
  }, []);

  const weightNum = Math.max(minValue, Math.min(maxValue, Number(weightInput) || 0));

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleAdjustWeight = useCallback(
    (delta) => {
      setWeightInput((prev) => {
        const cur = Number(prev) || 0;
        const next = Math.max(minValue, Math.min(maxValue, Math.round((cur + delta) * 10) / 10));
        return String(next);
      });
    },
    [minValue, maxValue]
  );

  const inputError = useMemo(() => {
    if (!weightInput || String(weightInput).trim() === '') return '';
    const num = Number(weightInput);
    if (Number.isNaN(num) || num < 0) {
      return 'Weight must be 0 or greater';
    }
    if (num > maxValue) {
      return `Maximum weight is ${maxValue} lbs`;
    }
    return '';
  }, [weightInput, maxValue]);

  const handleSelectPreset = useCallback((preset) => {
    setWeightInput(String(preset));
  }, []);

  const handleDirectInputChange = useCallback((raw) => {
    if (typeof raw === 'string' && raw.includes('-')) return;
    setWeightInput(raw);
  }, []);

  const handleInputBlur = useCallback(() => {
    setWeightInput((prev) => {
      if (!prev || String(prev).trim() === '') return '';
      const rounded = roundToHalf(prev);
      return String(Math.max(0, rounded));
    });
  }, []);

  const handleApply = useCallback(() => {
    if (inputError) return;
    if (onApplyWeight) {
      const rounded = roundToHalf(weightNum);
      const bandToApply = selectedBand?.level || null;
      onApplyWeight(Number(rounded) || 0, bandToApply);
    }
    onClose?.();
  }, [inputError, onApplyWeight, weightNum, selectedBand, onClose]);

  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        onClose?.();
      }
    },
    [onClose]
  );

  return {
    weightInput,
    weightNum,
    inputError,
    activeStep,
    setActiveStep,
    equipmentType,
    equipmentSubLabel,
    presetList,
    resistanceBandsList: RESISTANCE_BANDS,
    selectedBand,
    handleSelectBand,
    handleAdjustWeight,
    handleSelectPreset,
    handleDirectInputChange,
    handleInputBlur,
    handleApply,
    handleBackdropClick,
  };
}
