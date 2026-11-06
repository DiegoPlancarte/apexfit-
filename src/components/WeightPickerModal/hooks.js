import { useState, useCallback, useEffect, useMemo } from 'react';

export const DUMBBELL_PRESETS = [15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80];
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
 *
 * @param {string} exerciseName
 * @returns {'dumbbell'|'cable'|'machine'|'general'}
 */
export const detectEquipmentType = (exerciseName = '') => {
  const lower = exerciseName.toLowerCase();
  if (
    lower.includes('dumbbell') ||
    lower.includes('db ') ||
    lower.includes(' db') ||
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
}) => {
  const [weightInput, setWeightInput] = useState(() => {
    const num = Number(defaultValue);
    return Number.isFinite(num) && num > 0 ? String(num) : '25';
  });

  // Track prop updates without calling setState inside an effect
  const [prevDefault, setPrevDefault] = useState(defaultValue);
  if (defaultValue !== prevDefault) {
    setPrevDefault(defaultValue);
    const num = Number(defaultValue);
    setWeightInput(Number.isFinite(num) && num > 0 ? String(num) : '25');
  }

  // Active step size (e.g. 2.5 or 5)
  const [activeStep, setActiveStep] = useState(stepValue || 5);

  const equipmentType = useMemo(() => detectEquipmentType(exerciseName), [exerciseName]);

  const presetList = useMemo(() => {
    switch (equipmentType) {
      case 'dumbbell':
        return DUMBBELL_PRESETS;
      case 'cable':
        return CABLE_PRESETS;
      case 'machine':
        return MACHINE_PRESETS;
      default:
        return GENERAL_PRESETS;
    }
  }, [equipmentType]);

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
      onApplyWeight(Number(rounded) || 0);
    }
    onClose?.();
  }, [inputError, onApplyWeight, weightNum, onClose]);

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
    presetList,
    handleAdjustWeight,
    handleSelectPreset,
    handleDirectInputChange,
    handleInputBlur,
    handleApply,
    handleBackdropClick,
  };
}
