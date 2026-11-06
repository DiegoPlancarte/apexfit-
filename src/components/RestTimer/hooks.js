import { useEffect, useRef, useState } from 'react';

export const formatTime = (totalSeconds) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const useComponentLogic = ({
  activeExercise = null,
  triggerKey = 0,
  targetSetInfo = null,
  onRestUpdate,
  onStopOrCompleteRest,
}) => {
  const exerciseRestSec =
    Number(targetSetInfo?.restDurationSec) ||
    Number(activeExercise?.restDurationSec) ||
    90;

  const [remainingSec, setRemainingSec] = useState(exerciseRestSec);
  const [elapsedRestSec, setElapsedRestSec] = useState(0);
  const [status, setStatus] = useState('idle'); // 'idle' | 'running' | 'paused' | 'finished'

  // Track prop changes to auto-start on set completion or sync when switching exercises
  const [prevTriggerKey, setPrevTriggerKey] = useState(triggerKey);
  const [prevExerciseContext, setPrevExerciseContext] = useState({
    id: activeExercise?.id,
    restDurationSec: exerciseRestSec,
  });

  if (triggerKey !== prevTriggerKey) {
    setPrevTriggerKey(triggerKey);
    if (triggerKey > 0) {
      const nextDuration =
        Number(targetSetInfo?.restDurationSec) ||
        Number(activeExercise?.restDurationSec) ||
        90;
      setPrevExerciseContext({
        id: targetSetInfo?.exerciseId || activeExercise?.id,
        restDurationSec: nextDuration,
      });
      setRemainingSec(nextDuration);
      setElapsedRestSec(0);
      setStatus('running');
    }
  } else if (
    activeExercise?.id !== prevExerciseContext.id ||
    exerciseRestSec !== prevExerciseContext.restDurationSec
  ) {
    setPrevExerciseContext({
      id: activeExercise?.id,
      restDurationSec: exerciseRestSec,
    });
    if (status === 'idle' || status === 'finished') {
      setRemainingSec(exerciseRestSec);
      setElapsedRestSec(0);
    }
  }

  const onRestUpdateRef = useRef(onRestUpdate);
  const onStopOrCompleteRestRef = useRef(onStopOrCompleteRest);

  useEffect(() => {
    onRestUpdateRef.current = onRestUpdate;
    onStopOrCompleteRestRef.current = onStopOrCompleteRest;
  }, [onRestUpdate, onStopOrCompleteRest]);

  // Core 1-second interval timer for countdown and elapsed rest tracking
  useEffect(() => {
    if (status !== 'running') return undefined;

    const intervalId = setInterval(() => {
      setElapsedRestSec((prevElapsed) => {
        const nextElapsed = prevElapsed + 1;
        if (onRestUpdateRef.current && targetSetInfo?.setId) {
          onRestUpdateRef.current(targetSetInfo.setId, nextElapsed);
        }
        return nextElapsed;
      });

      setRemainingSec((prevRemaining) => {
        if (prevRemaining <= 1) {
          setStatus('finished');
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }
          if (onStopOrCompleteRestRef.current) {
            onStopOrCompleteRestRef.current();
          }
          return 0;
        }
        return prevRemaining - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [status, targetSetInfo]);

  const handleStartOrResume = () => {
    if (status === 'finished' || remainingSec <= 0) {
      setRemainingSec(exerciseRestSec);
      setElapsedRestSec(0);
    }
    setStatus('running');
  };

  const handlePause = () => {
    setStatus('paused');
  };

  // Stop button: halts the timer early before starting the next set, preserving elapsed rest time
  const handleStop = () => {
    if (onRestUpdateRef.current && targetSetInfo?.setId) {
      onRestUpdateRef.current(targetSetInfo.setId, elapsedRestSec);
    }
    setStatus('idle');
    setRemainingSec(exerciseRestSec);
    if (onStopOrCompleteRest) {
      onStopOrCompleteRest(elapsedRestSec);
    }
  };

  const progressPct =
    exerciseRestSec > 0
      ? Math.min(
          100,
          Math.max(0, ((exerciseRestSec - remainingSec) / exerciseRestSec) * 100)
        )
      : 0;

  return {
    durationSec: exerciseRestSec,
    remainingSec,
    elapsedRestSec,
    status,
    progressPct,
    activeExerciseName:
      targetSetInfo?.exerciseName || activeExercise?.exerciseName || 'Current Exercise',
    formattedRemaining: formatTime(remainingSec),
    formattedDuration: formatTime(exerciseRestSec),
    handleStartOrResume,
    handlePause,
    handleStop,
  };
}
