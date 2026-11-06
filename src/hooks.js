import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { ACTIVE_WORKOUT_GUARD_MESSAGE } from './config/workoutGuard';
import { getLocalDateString, getLocalIsoString } from './utils/date';
import { formatClock } from './utils/format';
import {
  DEFAULT_WEEKLY_PLAN,
  buildWorkoutPayload,
  getApiUrl,
  setApiUrl,
  syncWorkoutToSheets,
  updatePlanDayStatus,
} from './services/api';
import {
  initSyncManager,
  flushSyncOutbox,
  runAllSyncs,
  saveSession,
  getSessions,
  ensureDatabaseSeeded,
  extractProgressiveOverloadHistory,
} from './services/db';

const STORAGE_KEY_ACTIVE_WORKOUT = 'workout_tracker_active_session_v1';
const STORAGE_KEY_LAST_HISTORY = 'workout_tracker_last_history_v1';
const STORAGE_KEY_EXERCISE_REST = 'workout_tracker_exercise_rest_v1';
const STORAGE_KEY_COMPLETED_DAYS = 'workout_tracker_completed_days_v1';

const DEFAULT_EXERCISE_REST = {
  'Barbell Bench Press': 90,
  'Incline Dumbbell Press': 90,
  'Barbell Back Squat': 120,
  'Romanian Deadlift': 120,
  'Lat Pulldown': 90,
  'Seated Cable Row': 90,
  'Overhead Shoulder Press': 90,
  'Lateral Raise': 60,
};

const createSetRecord = (exerciseName, setNumber, defaults = {}) => {
  const activeSec = defaults.active_sec ?? defaults.Active_Sec ?? defaults.setActiveSec ?? defaults.Set_Active_Sec ?? null;
  return {
    id: `set_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    exerciseName,
    setNumber,
    weightLbs: defaults.weightLbs ?? '',
    reps: defaults.reps ?? '',
    rir: defaults.rir ?? 2,
    setActiveSec: activeSec,
    active_sec: activeSec,
    Active_Sec: activeSec,
    Set_Active_Sec: activeSec,
    activeStartedAt: defaults.activeStartedAt ?? null,
    restAfterSec: defaults.restAfterSec ?? 0,
    completed: Boolean(defaults.completed ?? false),
    completedAt: defaults.completedAt ?? null,
  };
};

const createInitialWorkoutState = (
  historyMap = {},
  restMap = DEFAULT_EXERCISE_REST
) => {
  const starterExercises = ['Barbell Bench Press', 'Incline Dumbbell Press'];

  return {
    sessionId: `sess_${Date.now()}`,
    workoutName: 'Upper Body Hypertrophy',
    startedAt: null, // Started manually via topbar Start button
    notes: '',
    exercises: starterExercises.map((exerciseName, idx) => {
      const prevSets = historyMap[exerciseName] || [];
      const initialCount = Math.max(2, prevSets.length || 3);
      const restDurationSec = Number(restMap[exerciseName]) || 90;
      return {
        id: `ex_${Date.now()}_${idx}`,
        exerciseName,
        restDurationSec,
        sets: Array.from({ length: initialCount }, (_, sIdx) => {
          const prev = prevSets[sIdx] || prevSets[prevSets.length - 1] || {};
          return createSetRecord(exerciseName, sIdx + 1, {
            weightLbs: prev.weightLbs ?? '',
            reps: prev.reps ?? '',
            rir: prev.rir ?? 2,
            setActiveSec: prev.active_sec ?? prev.setActiveSec ?? null,
            restAfterSec: 0,
          });
        }),
      };
    }),
  };
};

export const useComponentLogic = () => {
  // Load per-exercise rest duration preferences (e.g. Bench = 60s, Incline DB = 90s)
  const activeSetAnchorRef = useRef(null);

  const [exerciseRestMap, setExerciseRestMap] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EXERCISE_REST);
      return saved
        ? { ...DEFAULT_EXERCISE_REST, ...JSON.parse(saved) }
        : DEFAULT_EXERCISE_REST;
    } catch {
      return DEFAULT_EXERCISE_REST;
    }
  });

  // Load previous session history for progressive overload reference
  const [lastSessionHistory, setLastSessionHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LAST_HISTORY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Load active workout state from localStorage to survive mobile browser refresh
  const [workoutState, setWorkoutState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_WORKOUT);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.exercises)) {
          // Ensure every exercise has restDurationSec populated
          return {
            ...parsed,
            exercises: parsed.exercises.map((ex) => ({
              ...ex,
              restDurationSec:
                Number(ex.restDurationSec) ||
                Number(DEFAULT_EXERCISE_REST[ex.exerciseName]) ||
                Number(parsed.defaultRestSec) ||
                90,
            })),
          };
        }
      }
    } catch (err) {
      console.error('Failed to restore workout state from localStorage:', err);
    }
    return createInitialWorkoutState();
  });

  // Current view: 'dashboard' (weekly overview) or 'workout' (active session logger)
  const [currentView, setCurrentView] = useState('dashboard');

  // Track completed days to update the weekly plan cards
  const [completedDayNumbers, setCompletedDayNumbers] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COMPLETED_DAYS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Track which exercise is currently active/focused for the RestTimer
  const [focusedExerciseId, setFocusedExerciseId] = useState(
    () => workoutState.exercises[0]?.id || null
  );

  // Rest timer trigger state
  const [restTriggerKey, setRestTriggerKey] = useState(0);
  const [activeRestSetInfo, setActiveRestSetInfo] = useState(null);

  // Session elapsed clock
  const [sessionElapsedSec, setSessionElapsedSec] = useState(() => {
    if (!workoutState.startedAt) return 0;
    const startMs = new Date(workoutState.startedAt).getTime();
    return Number.isNaN(startMs) ? 0 : Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  });

  // Settings & Payload Preview drawer state
  const [showSettings, setShowSettings] = useState(false);
  const [gasUrlInput, setGasUrlInput] = useState(() => getApiUrl());
  const [syncStatus, setSyncStatus] = useState({ loading: false, type: '', message: '' });

  // Persist active workout state to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_WORKOUT, JSON.stringify(workoutState));
    } catch (err) {
      console.error('Failed to save workout state to localStorage:', err);
    }
  }, [workoutState]);

  // Persist progressive overload history
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LAST_HISTORY, JSON.stringify(lastSessionHistory));
    } catch (err) {
      console.error('Failed to save history to localStorage:', err);
    }
  }, [lastSessionHistory]);

  // Persist per-exercise rest duration preferences
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EXERCISE_REST, JSON.stringify(exerciseRestMap));
    } catch (err) {
      console.error('Failed to save exercise rest preferences:', err);
    }
  }, [exerciseRestMap]);

  // Persist completed days for the weekly plan
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COMPLETED_DAYS, JSON.stringify(completedDayNumbers));
    } catch (err) {
      console.warn('Failed to save completed days to localStorage:', err);
    }
  }, [completedDayNumbers]);

  // Background Sync Outbox Manager: automatically flushes pending offline actions on reconnection
  useEffect(() => {
    const cleanup = initSyncManager((res) => {
      if (res?.flushed > 0) {
        setSyncStatus({
          loading: false,
          type: 'success',
          message: `Synced ${res.flushed} offline action${res.flushed > 1 ? 's' : ''} to Google Sheets!`,
        });
      }
    });
    return cleanup;
  }, []);

  // Automatic Sync on Load: executes background flush on initial application mount
  // ensuring local sessions and sets sync to Google Sheets without user intervention
  useEffect(() => {
    let isMounted = true;
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      flushSyncOutbox()
        .then((res) => {
          if (isMounted && res?.flushed > 0) {
            setSyncStatus({
              loading: false,
              type: 'success',
              message: `Auto-synced ${res.flushed} offline action${res.flushed > 1 ? 's' : ''} to Google Sheets!`,
            });
          }
        })
        .catch((err) => {
          console.warn('Automatic sync on load failed:', err);
        });
    }
    return () => {
      isMounted = false;
    };
  }, []);

  // Hydrate progressive overload reference history from IndexedDB sessions on mount
  useEffect(() => {
    let isMounted = true;
    ensureDatabaseSeeded()
      .then(() => getSessions())
      .then((sessions) => {
        if (isMounted && Array.isArray(sessions) && sessions.length > 0) {
          const dynamicOverloadHistory = extractProgressiveOverloadHistory(sessions);
          setLastSessionHistory((prev) => ({
            ...dynamicOverloadHistory,
            ...prev,
          }));
        }
      })
      .catch((err) => {
        console.warn('Failed to hydrate overload history from IndexedDB:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Update progressive overload reference history whenever an existing session is edited
  useEffect(() => {
    const handleSessionUpdated = (e) => {
      const updatedSession = e?.detail;
      if (updatedSession && Array.isArray(updatedSession.exercises)) {
        setLastSessionHistory((prevHistory) => {
          const updated = { ...prevHistory };
          updatedSession.exercises.forEach((ex) => {
            const name = ex.exerciseName || ex.name;
            if (name && Array.isArray(ex.sets)) {
              updated[name] = ex.sets.map((s, idx) => ({
                setNumber: idx + 1,
                weightLbs: Number(s.weightLbs || 0),
                reps: Number(s.reps || 0),
                rir: s.rir !== null && s.rir !== undefined && s.rir !== '' ? Number(s.rir) : 2,
              }));
            }
          });
          return updated;
        });
      }
    };
    window.addEventListener('apexfit:session-updated', handleSessionUpdated);
    return () => {
      window.removeEventListener('apexfit:session-updated', handleSessionUpdated);
    };
  }, []);

  // Update total session elapsed timer (only runs when workout has been started)
  useEffect(() => {
    if (!workoutState.startedAt) return undefined;

    const updateElapsed = () => {
      const startMs = new Date(workoutState.startedAt).getTime();
      if (!Number.isNaN(startMs)) {
        setSessionElapsedSec(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
      }
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [workoutState.startedAt]);

  // 3-second countdown overlay state
  const [isCountdownActive, setIsCountdownActive] = useState(false);

  const handleTriggerStartWorkout = useCallback(() => {
    setIsCountdownActive(true);
  }, []);

  const handleCountdownComplete = useCallback(() => {
    setIsCountdownActive(false);
    const nowIso = getLocalIsoString();
    activeSetAnchorRef.current = nowIso;
    setWorkoutState((prev) => ({
      ...prev,
      startedAt: nowIso,
    }));
    setSessionElapsedSec(0);
  }, []);

  const handleCancelCountdown = useCallback(() => {
    setIsCountdownActive(false);
  }, []);

  const handleStartWorkout = useCallback(() => {
    const nowIso = getLocalIsoString();
    activeSetAnchorRef.current = nowIso;
    setWorkoutState((prev) => ({
      ...prev,
      startedAt: nowIso,
    }));
    setSessionElapsedSec(0);
  }, []);

  const handleUpdateWorkoutMeta = useCallback((patch) => {
    setWorkoutState((prev) => ({ ...prev, ...patch }));
  }, []);

  // Update rest duration at the exercise level (persists for all sets of this exercise)
  const handleUpdateExerciseRest = useCallback((exerciseId, newRestSec) => {
    const safeRestSec = Math.max(5, Number(newRestSec) || 60);
    let targetExerciseName = null;

    setWorkoutState((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        targetExerciseName = ex.exerciseName;
        return {
          ...ex,
          restDurationSec: safeRestSec,
        };
      }),
    }));

    if (targetExerciseName) {
      setExerciseRestMap((prev) => ({
        ...prev,
        [targetExerciseName]: safeRestSec,
      }));
    }

    setActiveRestSetInfo((prev) =>
      prev && prev.exerciseId === exerciseId
        ? { ...prev, restDurationSec: safeRestSec }
        : prev
    );
  }, []);

  const handleAddExercise = useCallback(
    (exerciseName) => {
      const savedRestSec = Number(exerciseRestMap[exerciseName]) || 90;
      const prevSets = lastSessionHistory[exerciseName] || [];
      const newExerciseId = `ex_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      setWorkoutState((prev) => {
        const newExercise = {
          id: newExerciseId,
          exerciseName,
          restDurationSec: savedRestSec,
          sets: [
            createSetRecord(exerciseName, 1, {
              weightLbs: prevSets[0]?.weightLbs ?? '',
              reps: prevSets[0]?.reps ?? '',
              rir: prevSets[0]?.rir ?? 2,
              setActiveSec: prevSets[0]?.active_sec ?? prevSets[0]?.setActiveSec ?? null,
            }),
          ],
        };
        return {
          ...prev,
          exercises: [...prev.exercises, newExercise],
        };
      });

      setFocusedExerciseId(newExerciseId);
    },
    [exerciseRestMap, lastSessionHistory]
  );

  const handleRemoveExercise = useCallback((exerciseId) => {
    setWorkoutState((prev) => ({
      ...prev,
      exercises: prev.exercises.filter((ex) => ex.id !== exerciseId),
    }));
  }, []);

  const handleUpdateSet = useCallback((exerciseId, setId, changes) => {
    setFocusedExerciseId(exerciseId);
    setWorkoutState((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...changes } : s)),
        };
      }),
    }));
  }, []);

  const handleToggleCompleteSet = useCallback(
    (exerciseId, setId) => {
      const targetExercise = workoutState.exercises.find((ex) => ex.id === exerciseId);
      const targetSet = targetExercise?.sets.find((s) => s.id === setId);
      if (!targetExercise || !targetSet) return;

      const isCompleting = !targetSet.completed;
      const exerciseRestSec = Number(targetExercise.restDurationSec) || 90;
      const nowIso = getLocalIsoString();

      setFocusedExerciseId(exerciseId);

      let calculatedActiveSec = targetSet.active_sec ?? targetSet.setActiveSec ?? null;

      if (isCompleting) {
        // Determine active set start time anchor:
        // 1. Explicit set activeStartedAt
        // 2. Preceding rest timer finish anchor (activeSetAnchorRef.current)
        // 3. Session start timestamp (workoutState.startedAt)
        // 4. Current time fallback
        const anchorTimeStr =
          targetSet.activeStartedAt ||
          activeSetAnchorRef.current ||
          workoutState.startedAt ||
          nowIso;

        const startTimeMs = new Date(anchorTimeStr).getTime();
        const completionTimeMs = new Date(nowIso).getTime();
        const elapsedMs = completionTimeMs - startTimeMs;

        // Calculate wall-clock active duration in seconds (clamped to minimum 1s)
        calculatedActiveSec = Math.max(1, Math.round(elapsedMs / 1000));
      }

      setWorkoutState((prev) => {
        const sessionStartedAt = prev.startedAt || (isCompleting ? nowIso : prev.startedAt);
        return {
          ...prev,
          startedAt: sessionStartedAt,
          exercises: prev.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;
            return {
              ...ex,
              sets: ex.sets.map((s) => {
                if (s.id !== setId) return s;
                return {
                  ...s,
                  weightLbs: s.weightLbs === '' ? 0 : Number(s.weightLbs),
                  reps: s.reps === '' ? 0 : Number(s.reps),
                  completed: isCompleting,
                  completedAt: isCompleting ? nowIso : null,
                  setActiveSec: isCompleting ? calculatedActiveSec : null,
                  active_sec: isCompleting ? calculatedActiveSec : null,
                  Active_Sec: isCompleting ? calculatedActiveSec : null,
                  Set_Active_Sec: isCompleting ? calculatedActiveSec : null,
                  activeStartedAt: isCompleting
                    ? s.activeStartedAt || activeSetAnchorRef.current || workoutState.startedAt || nowIso
                    : null,
                };
              }),
            };
          }),
        };
      });

      // Automatically start the RestTimer using this exercise's configured rest duration
      if (isCompleting) {
        setActiveRestSetInfo({
          setId: targetSet.id,
          exerciseId: targetExercise.id,
          exerciseName: targetExercise.exerciseName,
          setNumber: targetSet.setNumber,
          restDurationSec: exerciseRestSec,
        });
        setRestTriggerKey((k) => k + 1);
      }
    },
    [workoutState.exercises, workoutState.startedAt]
  );

  const handleAddSet = useCallback((exerciseId) => {
    setFocusedExerciseId(exerciseId);
    setWorkoutState((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        const nextSetNumber = ex.sets.length + 1;
        const newSet = createSetRecord(ex.exerciseName, nextSetNumber, {
          weightLbs: lastSet ? lastSet.weightLbs : '',
          reps: lastSet ? lastSet.reps : '',
          rir: lastSet ? lastSet.rir : 2,
          setActiveSec: null,
          active_sec: null,
          restAfterSec: 0,
        });
        return {
          ...ex,
          sets: [...ex.sets, newSet],
        };
      }),
    }));
  }, []);

  const handleRemoveSet = useCallback((exerciseId, setId) => {
    setWorkoutState((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        const filtered = ex.sets
          .filter((s) => s.id !== setId)
          .map((s, idx) => ({ ...s, setNumber: idx + 1 }));
        return {
          ...ex,
          sets: filtered,
        };
      }),
    }));
  }, []);

  const handleRestoreSet = useCallback((exerciseId, restoredSet, atIndex) => {
    if (!exerciseId || !restoredSet) return;
    setWorkoutState((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        const newSets = [...ex.sets];
        const insertIndex =
          typeof atIndex === 'number' && atIndex >= 0 && atIndex <= newSets.length
            ? atIndex
            : newSets.length;
        newSets.splice(insertIndex, 0, restoredSet);
        const renumbered = newSets.map((s, idx) => ({ ...s, setNumber: idx + 1 }));
        return {
          ...ex,
          sets: renumbered,
        };
      }),
    }));
  }, []);

  // Live callback from RestTimer to record actual `restAfterSec` onto the logged set
  const handleRestUpdate = useCallback((setId, elapsedRestSec) => {
    if (!setId) return;
    setWorkoutState((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) => ({
        ...ex,
        sets: ex.sets.map((s) =>
          s.id === setId ? { ...s, restAfterSec: elapsedRestSec } : s
        ),
      })),
    }));
  }, []);

  // When a rest period stops or finishes, if all sets of that exercise are done,
  // automatically shift focus to the next exercise with incomplete sets so its rest time is loaded.
  const advanceFocusIfExerciseFinished = useCallback(
    (completedExerciseId) => {
      const currentEx = workoutState.exercises.find((ex) => ex.id === completedExerciseId);
      if (!currentEx) return;
      const allSetsDone = currentEx.sets.length > 0 && currentEx.sets.every((s) => s.completed);
      if (allSetsDone) {
        const nextIncompleteEx = workoutState.exercises.find(
          (ex) => ex.id !== completedExerciseId && ex.sets.some((s) => !s.completed)
        );
        if (nextIncompleteEx) {
          setFocusedExerciseId(nextIncompleteEx.id);
        }
      }
    },
    [workoutState.exercises]
  );

  const handleStopOrCompleteRest = useCallback(
    (elapsedRestSec) => {
      const restEndedIso = getLocalIsoString();
      activeSetAnchorRef.current = restEndedIso;

      if (activeRestSetInfo?.setId && typeof elapsedRestSec === 'number') {
        handleRestUpdate(activeRestSetInfo.setId, elapsedRestSec);
      }
      if (activeRestSetInfo?.exerciseId) {
        advanceFocusIfExerciseFinished(activeRestSetInfo.exerciseId);
      }

      // Anchor the start time of the next incomplete set precisely to when the rest timer finished
      setWorkoutState((prev) => {
        let anchored = false;
        return {
          ...prev,
          exercises: prev.exercises.map((ex) => ({
            ...ex,
            sets: ex.sets.map((s) => {
              if (!anchored && !s.completed && !s.activeStartedAt) {
                anchored = true;
                return { ...s, activeStartedAt: restEndedIso };
              }
              return s;
            }),
          })),
        };
      });

      setActiveRestSetInfo(null);
    },
    [activeRestSetInfo, handleRestUpdate, advanceFocusIfExerciseFinished]
  );

  const handleSaveSettings = useCallback(
    (e) => {
      if (e && e.preventDefault) e.preventDefault();
      setApiUrl(gasUrlInput);
      setShowSettings(false);
      setSyncStatus({
        loading: false,
        type: 'info',
        message: 'Google Apps Script endpoint saved locally.',
      });
    },
    [gasUrlInput]
  );

  // Update progressive overload history from completed sets
  const saveCompletedSetsToHistory = useCallback(() => {
    setLastSessionHistory((prevHistory) => {
      const updated = { ...prevHistory };
      workoutState.exercises.forEach((ex) => {
        const completed = ex.sets.filter((s) => s.completed);
        if (completed.length > 0) {
          updated[ex.exerciseName] = completed.map((s, idx) => ({
            setNumber: idx + 1,
            weightLbs: Number(s.weightLbs || 0),
            reps: Number(s.reps || 0),
            rir: s.rir,
            active_sec: s.active_sec ?? s.setActiveSec ?? null,
            setActiveSec: s.active_sec ?? s.setActiveSec ?? null,
          }));
        }
      });
      return updated;
    });
  }, [workoutState.exercises]);

  const handleSyncWorkout = useCallback(async () => {
    setSyncStatus({ loading: true, type: 'info', message: 'Saving session and syncing...' });
    try {
      // Filter exercises to only those having at least one completed set
      const completedExercises = (workoutState.exercises || [])
        .map((ex) => ({
          ...ex,
          sets: (ex.sets || []).filter((s) => s.completed),
        }))
        .filter((ex) => ex.sets.length > 0);

      const allCompletedSets = completedExercises.flatMap((ex) => ex.sets);
      const nowIso = getLocalIsoString();
      const endedAt = nowIso;
      const durationSec = sessionElapsedSec;

      if (allCompletedSets.length > 0) {
        const payload = buildWorkoutPayload({
          ...workoutState,
          exercises: completedExercises,
          endedAt,
          durationSec,
        });

        // Save completed session to local IndexedDB logbook immediately
        const completedHistorySession = {
          sessionId: payload.session.sessionId,
          date: payload.session.date || getLocalDateString(),
          Date: payload.session.date || getLocalDateString(),
          created_at: payload.session.startedAt || nowIso,
          workoutName: payload.session.workoutName,
          type: 'workout',
          startedAt: payload.session.startedAt,
          endedAt: payload.session.endedAt,
          durationSec: payload.session.durationSec,
          totalSets: payload.session.totalSets,
          totalVolumeLbs: payload.session.totalVolumeLbs,
          highlight: `${payload.session.totalVolumeLbs.toLocaleString()} lbs total volume • ${allCompletedSets.length} sets`,
          notes: payload.session.notes,
          exercises: completedExercises,
          day_index: payload.session.day_index,
          dayNumber: payload.session.dayNumber,
          planDayNumber: payload.session.planDayNumber,
        };
        await saveSession(completedHistorySession).catch(() => {});

        // Update progressive overload history from completed sets
        setLastSessionHistory((prevHistory) => {
          const updated = { ...prevHistory };
          completedExercises.forEach((ex) => {
            updated[ex.exerciseName] = ex.sets.map((s, idx) => ({
              setNumber: idx + 1,
              weightLbs: Number(s.weightLbs || 0),
              reps: Number(s.reps || 0),
              rir: s.rir,
              active_sec: s.active_sec ?? s.setActiveSec ?? null,
              setActiveSec: s.active_sec ?? s.setActiveSec ?? null,
            }));
          });
          return updated;
        });

        // Sync to Google Sheets
        const syncResult = await syncWorkoutToSheets(payload, gasUrlInput);

        // Trigger immediate outbox sync (runAllSyncs) to flush queue to Google Sheets
        await runAllSyncs(gasUrlInput).catch(() => {});

        // Flip scheduled plan day status if linked
        const planDayNum = workoutState.planDayNumber || payload.session.planDayNumber || payload.session.day_index;
        if (planDayNum) {
          setCompletedDayNumbers((prev) =>
            prev.includes(planDayNum) ? prev : [...prev, planDayNum]
          );
          updatePlanDayStatus(planDayNum, 'Completed', gasUrlInput);

          try {
            const perfSnapshot = `${payload.session.totalVolumeLbs.toLocaleString()} lbs total volume • ${allCompletedSets.length} sets`;
            const savedMetrics = JSON.parse(
              localStorage.getItem('workout_tracker_perf_metrics_v1') || '{}'
            );
            savedMetrics[planDayNum] = perfSnapshot;
            localStorage.setItem('workout_tracker_perf_metrics_v1', JSON.stringify(savedMetrics));
          } catch {
            // ignore
          }
        }

        setSyncStatus({
          loading: false,
          type: 'success',
          message: syncResult?.isOffline
            ? 'Saved locally to database! Queued for auto-sync when online.'
            : `Completed & synced ${allCompletedSets.length} sets to Google Sheets!`,
        });
      } else {
        setSyncStatus({
          loading: false,
          type: 'info',
          message: 'Session ended with no sets completed. Workout reset.',
        });
      }

      // Clear the active workout state (startedAt = null automatically lifts navigation/view guards)
      const fresh = createInitialWorkoutState(lastSessionHistory, exerciseRestMap);
      setWorkoutState(fresh);
      setSessionElapsedSec(0);
      setFocusedExerciseId(fresh.exercises[0]?.id || null);
      setActiveRestSetInfo(null);

      // Return to dashboard
      setCurrentView('dashboard');
    } catch (error) {
      console.error('Error concluding session:', error);
      setSyncStatus({
        loading: false,
        type: 'error',
        message: error.message || 'Failed to complete session and sync.',
      });
    }
  }, [
    workoutState,
    sessionElapsedSec,
    gasUrlInput,
    lastSessionHistory,
    exerciseRestMap,
    setCurrentView,
  ]);

  const isWorkoutStarted = Boolean(workoutState.startedAt);

  // Active workout interaction & navigation guard state
  const [isGuardModalOpen, setIsGuardModalOpen] = useState(false);
  const [guardAlertMessage, setGuardAlertMessage] = useState(ACTIVE_WORKOUT_GUARD_MESSAGE);

  const handleTriggerGuardAlert = useCallback((customMsg) => {
    setGuardAlertMessage(customMsg || ACTIVE_WORKOUT_GUARD_MESSAGE);
    setIsGuardModalOpen(true);
  }, []);

  const handleCloseGuardModal = useCallback(() => {
    setIsGuardModalOpen(false);
  }, []);

  const handleResumeActiveWorkout = useCallback(() => {
    setIsGuardModalOpen(false);
    setCurrentView('workout');
  }, []);

  const guardedNavigate = useCallback(
    (targetView) => {
      if (isWorkoutStarted && targetView !== 'workout') {
        handleTriggerGuardAlert();
        return false;
      }
      setCurrentView(targetView);
      return true;
    },
    [isWorkoutStarted, handleTriggerGuardAlert]
  );

  // End Workout Early / Premature Completion State & Actions
  const [isEndEarlyModalOpen, setIsEndEarlyModalOpen] = useState(false);

  const handleRequestEndEarly = useCallback(() => {
    setIsEndEarlyModalOpen(true);
  }, []);

  const handleCancelEndEarly = useCallback(() => {
    setIsEndEarlyModalOpen(false);
  }, []);

  const handleConfirmEndEarly = useCallback(async () => {
    setIsEndEarlyModalOpen(false);
    await handleSyncWorkout();
  }, [handleSyncWorkout]);

  const handleSelectWorkoutDay = useCallback(
    (dayItem) => {
      if (isWorkoutStarted) {
        // If a workout is underway, prevent altering the active plan to another day's template
        if (workoutState.planDayNumber && dayItem.dayNumber !== workoutState.planDayNumber) {
          handleTriggerGuardAlert();
          return;
        }
        // If user tapped the day card matching active session, return to active workout view
        setCurrentView('workout');
        return;
      }

      // If no sets are logged yet, load the day's template exercises
      const hasCompletedSets = workoutState.exercises.some((e) =>
        e.sets.some((s) => s.completed)
      );

      if (!hasCompletedSets && dayItem.targetExercises && dayItem.targetExercises.length > 0) {
        const newExercises = dayItem.targetExercises.map((exerciseName, idx) => {
          const prevSets = lastSessionHistory[exerciseName] || [];
          const initialCount = Math.max(2, prevSets.length || 3);
          const restDurationSec = Number(exerciseRestMap[exerciseName]) || 90;
          return {
            id: `ex_${Date.now()}_${idx}`,
            exerciseName,
            restDurationSec,
            sets: Array.from({ length: initialCount }, (_, sIdx) => {
              const prev = prevSets[sIdx] || prevSets[prevSets.length - 1] || {};
              return createSetRecord(exerciseName, sIdx + 1, {
                weightLbs: prev.weightLbs ?? 135,
                reps: prev.reps ?? 8,
                rir: prev.rir ?? 2,
                setActiveSec: prev.active_sec ?? prev.setActiveSec ?? null,
                restAfterSec: 0,
              });
            }),
          };
        });

        setWorkoutState((prev) => ({
          ...prev,
          workoutName: dayItem.title,
          planDayNumber: dayItem.dayNumber,
          exercises: newExercises,
        }));
      } else {
        setWorkoutState((prev) => ({
          ...prev,
          planDayNumber: dayItem.dayNumber,
          workoutName: prev.workoutName || dayItem.title,
        }));
      }

      setCurrentView('workout');
    },
    [isWorkoutStarted, workoutState.planDayNumber, workoutState.exercises, lastSessionHistory, exerciseRestMap, handleTriggerGuardAlert]
  );

  // Opens today's scheduled Workout of the Day (WOD)
  const handleOpenTodaysWod = useCallback(() => {
    if (isWorkoutStarted) {
      setCurrentView('workout');
      return;
    }

    const now = new Date();
    const dayOfWeek = now.getDay();
    const todaysDayNumber = dayOfWeek === 0 ? 7 : dayOfWeek;

    let activePlan = DEFAULT_WEEKLY_PLAN;
    try {
      const saved = localStorage.getItem('workout_tracker_weekly_plan_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          activePlan = parsed;
        }
      }
    } catch {
      // fallback
    }

    const todayPlanItem =
      activePlan.find((p) => p.dayNumber === todaysDayNumber) ||
      DEFAULT_WEEKLY_PLAN.find((p) => p.dayNumber === todaysDayNumber) ||
      DEFAULT_WEEKLY_PLAN[0];

    const activityType = (todayPlanItem.activityType || '').toLowerCase();
    const isLifting =
      activityType === 'workout' || activityType === 'lifting' || activityType === 'strength';

    if (isLifting) {
      handleSelectWorkoutDay(todayPlanItem);
      setCurrentView('workout');
    } else {
      setCurrentView('dashboard');
      const label =
        todayPlanItem.title ||
        todayPlanItem.badgeLabel ||
        (activityType === 'run' ? 'Cardio / Run' : 'Active Recovery');
      setSyncStatus({
        loading: false,
        type: 'info',
        message: `Today is scheduled for ${label} (${activityType === 'run' ? 'Cardio' : 'Active Recovery'}). Review details on your dashboard.`,
      });
    }
  }, [isWorkoutStarted, handleSelectWorkoutDay, setCurrentView]);

  const handleResetWorkout = useCallback(() => {
    saveCompletedSetsToHistory();
    activeSetAnchorRef.current = null;
    const fresh = createInitialWorkoutState(lastSessionHistory, exerciseRestMap);
    setWorkoutState(fresh);
    setSessionElapsedSec(0);
    setFocusedExerciseId(fresh.exercises[0]?.id || null);
    setActiveRestSetInfo(null);
    setSyncStatus({ loading: false, type: '', message: '' });
  }, [saveCompletedSetsToHistory, lastSessionHistory, exerciseRestMap]);

  // Determine the active exercise for the RestTimer HUD:
  // 1. If currently resting after a specific set, use that set's exercise
  // 2. Otherwise use the focused exercise (or first exercise with incomplete sets)
  const activeExerciseForRest = useMemo(() => {
    return (
      workoutState.exercises.find((ex) => ex.id === activeRestSetInfo?.exerciseId) ||
      workoutState.exercises.find((ex) => ex.id === focusedExerciseId) ||
      workoutState.exercises.find((ex) => ex.sets.some((s) => !s.completed)) ||
      workoutState.exercises[0] ||
      null
    );
  }, [workoutState.exercises, activeRestSetInfo?.exerciseId, focusedExerciseId]);

  // Memoize buildWorkoutPayload so heavy computation is skipped unless Settings modal is actually open
  const currentPayload = useMemo(() => {
    if (!showSettings) return null;
    return buildWorkoutPayload({
      ...workoutState,
      endedAt: getLocalIsoString(),
      durationSec: sessionElapsedSec,
    });
  }, [showSettings, workoutState, sessionElapsedSec]);

  const formattedSessionClock = useMemo(() => {
    return isWorkoutStarted ? formatClock(sessionElapsedSec) : '00:00 (Ready)';
  }, [isWorkoutStarted, sessionElapsedSec]);

  return {
    currentView,
    setCurrentView,
    completedDayNumbers,
    handleSelectWorkoutDay,
    handleOpenTodaysWod,
    workoutState,
    lastSessionHistory,
    restTriggerKey,
    activeRestSetInfo,
    activeExerciseForRest,
    isWorkoutStarted,
    isGuardModalOpen,
    guardAlertMessage,
    handleTriggerGuardAlert,
    handleCloseGuardModal,
    handleResumeActiveWorkout,
    guardedNavigate,
    isEndEarlyModalOpen,
    handleRequestEndEarly,
    handleCancelEndEarly,
    handleConfirmEndEarly,
    isCountdownActive,
    handleTriggerStartWorkout,
    handleCountdownComplete,
    handleCancelCountdown,
    handleStartWorkout,
    formattedSessionClock,
    showSettings,
    setShowSettings,
    gasUrlInput,
    setGasUrlInput,
    syncStatus,
    currentPayload,
    handleUpdateWorkoutMeta,
    handleUpdateExerciseRest,
    handleAddExercise,
    handleRemoveExercise,
    handleUpdateSet,
    handleToggleCompleteSet,
    handleAddSet,
    handleRemoveSet,
    handleRestoreSet,
    handleRestUpdate,
    handleStopOrCompleteRest,
    handleSaveSettings,
    handleSyncWorkout,
    handleResetWorkout,
  };
}
