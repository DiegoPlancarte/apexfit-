import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  TERRAIN_TYPES,
  getTerrainIcon,
  getStoredShoes,
  getActiveShoe,
  addMilesToShoe,
  secondsToPace,
} from '../../services/runningService';
import { syncRunToSheets } from '../../services/api';
import { getLocalDateString, getLocalIsoString } from '../../utils/date';

export const DISTANCE_PRESETS = [
  { label: '1 Mi', value: '1.0' },
  { label: '5K (3.11)', value: '3.11' },
  { label: '4 Mi', value: '4.0' },
  { label: '5 Mi', value: '5.0' },
  { label: '10K (6.21)', value: '6.21' },
  { label: '10 Mi', value: '10.0' },
  { label: 'Half (13.11)', value: '13.11' },
];

/**
 * Custom hook encapsulating state and actions for the ManualRunLogger form modal.
 */
export const useComponentLogic = ({
  isOpen,
  onClose,
  onSuccess,
  initialDayItem = null,
}) => {
  const todayStr = useMemo(() => getLocalDateString(), []);
  const currentTimeStr = useMemo(() => {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }, []);

  const [title, setTitle] = useState(() => initialDayItem?.title || 'Zone 2 Recovery Run');
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState(currentTimeStr);
  const [distance, setDistance] = useState('3.11');
  const [durationMinutes, setDurationMinutes] = useState('25');
  const [durationSeconds, setDurationSeconds] = useState('00');
  const [terrain, setTerrain] = useState('Road');
  const [shoeId, setShoeId] = useState(() => getActiveShoe()?.id || '');
  const [avgHeartRate, setAvgHeartRate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const shoes = useMemo(() => {
    if (!isOpen) return [];
    return getStoredShoes();
  }, [isOpen]);

  const selectedShoe = useMemo(() => {
    return shoes.find((s) => s.id === shoeId) || null;
  }, [shoes, shoeId]);

  // Compute total duration in seconds
  const totalSeconds = useMemo(() => {
    const mins = parseInt(durationMinutes, 10) || 0;
    const secs = parseInt(durationSeconds, 10) || 0;
    return Math.max(0, mins * 60 + secs);
  }, [durationMinutes, durationSeconds]);

  // Numeric distance in miles
  const distanceNum = useMemo(() => {
    const num = parseFloat(distance);
    return Number.isFinite(num) && num > 0 ? num : 0;
  }, [distance]);

  // Computed pace string (e.g., "8:02 /mi")
  const averagePaceStr = useMemo(() => {
    if (distanceNum <= 0 || totalSeconds <= 0) return '— /mi';
    const secPerMile = Math.round(totalSeconds / distanceNum);
    return `${secondsToPace(secPerMile)} /mi`;
  }, [distanceNum, totalSeconds]);

  // Computed kilometer metrics for convenience
  const kmDistanceStr = useMemo(() => {
    if (distanceNum <= 0) return '';
    return (distanceNum * 1.60934).toFixed(2);
  }, [distanceNum]);

  const kmPaceStr = useMemo(() => {
    if (distanceNum <= 0 || totalSeconds <= 0) return '';
    const km = distanceNum * 1.60934;
    const secPerKm = Math.round(totalSeconds / km);
    return `${secondsToPace(secPerKm)} /km`;
  }, [distanceNum, totalSeconds]);

  const [touchedFields, setTouchedFields] = useState({});

  const handleBlur = useCallback((fieldName) => {
    setTouchedFields((prev) => ({ ...prev, [fieldName]: true }));
  }, []);

  // Strict client-side validation rules
  const fieldErrors = useMemo(() => {
    const errors = {};
    if (!title.trim()) {
      errors.title = 'Activity title is required.';
    }
    const distVal = parseFloat(distance);
    if (!distance || !Number.isFinite(distVal) || distVal <= 0) {
      errors.distance = 'Distance must be greater than 0 miles.';
    }
    const mins = parseInt(durationMinutes, 10);
    const secs = parseInt(durationSeconds, 10);
    if (durationMinutes === '' || Number.isNaN(mins) || mins < 0) {
      errors.duration = 'Minutes must be 0 or greater.';
    } else if (durationSeconds === '' || Number.isNaN(secs) || secs < 0 || secs > 59) {
      errors.duration = 'Seconds must be between 0 and 59.';
    } else if (mins * 60 + secs <= 0) {
      errors.duration = 'Total duration must be at least 1 second.';
    }
    if (!date) {
      errors.date = 'Workout date is required.';
    }
    return errors;
  }, [title, distance, durationMinutes, durationSeconds, date]);

  const isFormValid = Object.keys(fieldErrors).length === 0;

  const handlePresetDistance = useCallback((presetVal) => {
    setDistance(presetVal);
    setErrorMsg('');
  }, []);

  const handleSelectTerrain = useCallback((t) => {
    setTerrain(t);
  }, []);

  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget && !isSubmitting) {
        onClose?.();
      }
    },
    [onClose, isSubmitting]
  );

  const handleSubmit = useCallback(
    async (e) => {
      if (e) e.preventDefault();
      setErrorMsg('');

      // Mark all fields touched on submit attempt
      setTouchedFields({
        title: true,
        distance: true,
        duration: true,
        date: true,
      });

      if (!isFormValid) {
        const firstError = Object.values(fieldErrors)[0];
        setErrorMsg(firstError || 'Please fix the highlighted fields.');
        return;
      }

      setIsSubmitting(true);

      try {
        const startedAtDate = new Date(`${date}T${time || '12:00'}:00`);
        const endedAtDate = new Date(startedAtDate.getTime() + totalSeconds * 1000);

        // Attribute mileage to the selected shoe odometer
        if (shoeId && distanceNum > 0) {
          addMilesToShoe(shoeId, distanceNum);
        }

        const runData = {
          title: title.trim() || `${terrain} Run`,
          date,
          Date: date,
          startedAt: getLocalIsoString(startedAtDate),
          endedAt: getLocalIsoString(endedAtDate),
          durationSec: totalSeconds,
          distanceMiles: distanceNum,
          avgPace: averagePaceStr,
          avgHeartRate: avgHeartRate ? Number(avgHeartRate) : null,
          terrain,
          shoeName: selectedShoe?.name || '',
          shoeId: selectedShoe?.id || '',
          notes: notes.trim(),
          highlight: `${distanceNum} mi • ${averagePaceStr}`,
        };

        const result = await syncRunToSheets(runData);

        setIsSubmitting(false);
        if (onSuccess) {
          onSuccess(result?.session || runData);
        }
        if (onClose) {
          onClose();
        }
      } catch (err) {
        console.error('Failed to log run session:', err);
        setErrorMsg(err.message || 'Failed to save run session. Please try again.');
        setIsSubmitting(false);
      }
    },
    [
      distanceNum,
      totalSeconds,
      date,
      time,
      shoeId,
      title,
      terrain,
      averagePaceStr,
      avgHeartRate,
      selectedShoe,
      notes,
      onSuccess,
      onClose,
      isFormValid,
      fieldErrors,
    ]
  );

  return {
    title,
    setTitle,
    date,
    setDate,
    time,
    setTime,
    distance,
    setDistance,
    durationMinutes,
    setDurationMinutes,
    durationSeconds,
    setDurationSeconds,
    terrain,
    terrainOptions: TERRAIN_TYPES,
    getTerrainIcon,
    shoeId,
    setShoeId,
    shoes,
    selectedShoe,
    avgHeartRate,
    setAvgHeartRate,
    notes,
    setNotes,
    distancePresets: DISTANCE_PRESETS,
    totalSeconds,
    distanceNum,
    averagePaceStr,
    kmDistanceStr,
    kmPaceStr,
    isSubmitting,
    errorMsg,
    fieldErrors,
    isFormValid,
    touchedFields,
    handleBlur,
    handlePresetDistance,
    handleSelectTerrain,
    handleBackdropClick,
    handleSubmit,
  };
}
