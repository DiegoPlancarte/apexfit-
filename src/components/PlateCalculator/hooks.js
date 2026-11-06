import { useState, useEffect, useCallback, useMemo } from 'react';

export const STANDARD_BAR_OPTIONS = [
  { label: '45 lb (Standard)', weight: 45 },
  { label: '35 lb (Women / Tech)', weight: 35 },
  { label: '25 lb (EZ-Curl)', weight: 25 },
  { label: '15 lb (Training)', weight: 15 },
];

export const STANDARD_PLATE_DENOMINATIONS = [45, 35, 25, 10, 5, 2.5];

export const QUICK_WEIGHT_PRESETS = [135, 185, 225, 275, 315, 365, 405];

/**
 * Calculates the plates required per side using standard plate denominations.
 *
 * @param {number} targetWeight - Total target weight in lbs
 * @param {number} barWeight - Weight of the barbell in lbs
 * @returns {Object} breakdown results
 */
export const calculatePlates = (targetWeight, barWeight = 45) => {
  const safeTarget = Math.max(0, Number(targetWeight) || 0);
  const safeBar = Math.max(0, Number(barWeight) || 0);

  if (safeTarget < safeBar) {
    return {
      weightPerSide: 0,
      platesNeeded: [],
      remainderPerSide: 0,
      totalLoadedWeight: safeBar,
      isUnderBarWeight: safeTarget > 0 && safeTarget < safeBar,
    };
  }

  const weightToLoad = safeTarget - safeBar;
  const weightPerSide = weightToLoad / 2;

  let remaining = weightPerSide;
  const platesNeeded = [];

  for (const plate of STANDARD_PLATE_DENOMINATIONS) {
    const count = Math.floor(remaining / plate);
    if (count > 0) {
      platesNeeded.push({
        weight: plate,
        count,
        totalWeight: count * plate,
      });
      // Round to 2 decimals to prevent floating-point precision issues
      remaining = Math.round((remaining - count * plate) * 100) / 100;
    }
  }

  const remainderPerSide = remaining;
  const loadedPerSide = weightPerSide - remainderPerSide;
  const totalLoadedWeight = safeBar + loadedPerSide * 2;

  return {
    weightPerSide,
    platesNeeded,
    remainderPerSide,
    totalLoadedWeight,
    isUnderBarWeight: false,
  };
}

/**
 * Custom hook managing the PlateCalculator state and interactions.
 */
export const useComponentLogic = ({
  isOpen,
  initialWeight = 135,
  initialBarWeight = 45,
  onClose,
  onApplyWeight,
}) => {
  const [targetWeightInput, setTargetWeightInput] = useState(() => {
    const parsed = Number(initialWeight);
    return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '135';
  });

  const [prevInitialWeight, setPrevInitialWeight] = useState(initialWeight);
  if (initialWeight !== prevInitialWeight) {
    setPrevInitialWeight(initialWeight);
    const parsed = Number(initialWeight);
    setTargetWeightInput(Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '135');
  }

  const [barWeight, setBarWeight] = useState(() => Number(initialBarWeight) || 45);
  const [isCustomBar, setIsCustomBar] = useState(false);
  const [customBarInput, setCustomBarInput] = useState('45');

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const effectiveBarWeight = isCustomBar
    ? Math.max(0, Number(customBarInput) || 0)
    : barWeight;

  const targetWeightNum = Math.max(0, Number(targetWeightInput) || 0);

  const inputError = useMemo(() => {
    if (!targetWeightInput || targetWeightInput.trim() === '') return '';
    const num = Number(targetWeightInput);
    if (Number.isNaN(num) || num < 0) {
      return 'Weight must be 0 or greater';
    }
    if (num > 1500) {
      return 'Weight exceeds safe barbell limit';
    }
    return '';
  }, [targetWeightInput]);

  const calculation = useMemo(
    () => calculatePlates(targetWeightNum, effectiveBarWeight),
    [targetWeightNum, effectiveBarWeight]
  );

  const handleAdjustWeight = useCallback((delta) => {
    setTargetWeightInput((prev) => {
      const current = Math.max(0, Number(prev) || 0);
      const next = Math.max(0, current + delta);
      return String(Math.round(next * 2) / 2);
    });
  }, []);

  const handleInputBlur = useCallback(() => {
    setTargetWeightInput((prev) => {
      const trimmed = String(prev).trim();
      if (!trimmed) return '0';
      const num = Number(trimmed);
      if (!Number.isFinite(num) || num < 0) return '0';
      return String(Math.round(num * 2) / 2);
    });
  }, []);

  const handleSelectBarOption = useCallback((weight) => {
    setIsCustomBar(false);
    setBarWeight(weight);
  }, []);

  const handleEnableCustomBar = useCallback(() => {
    setIsCustomBar(true);
  }, []);

  const handlePresetClick = useCallback((presetWeight) => {
    setTargetWeightInput(String(presetWeight));
  }, []);

  const handleApply = useCallback(() => {
    if (inputError) return;
    if (onApplyWeight) {
      const rounded = Math.round(targetWeightNum * 2) / 2;
      onApplyWeight(rounded);
    }
    onClose?.();
  }, [inputError, onApplyWeight, targetWeightNum, onClose]);

  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        onClose?.();
      }
    },
    [onClose]
  );

  return {
    targetWeightInput,
    setTargetWeightInput,
    targetWeightNum,
    inputError,
    barWeight: effectiveBarWeight,
    isCustomBar,
    customBarInput,
    setCustomBarInput,
    calculation,
    handleAdjustWeight,
    handleInputBlur,
    handleSelectBarOption,
    handleEnableCustomBar,
    handlePresetClick,
    handleApply,
    handleBackdropClick,
  };
}
