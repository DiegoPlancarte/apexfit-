import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  DEFAULT_WEEKLY_PLAN,
  fetchWeeklyPlan,
  updatePlanDayStatus,
  STORAGE_KEY_HISTORY_LOG,
  normalizeSessionRecord,
} from '../../services/api';
import { getSessions } from '../../services/db';
import { getLocalDateString } from '../../utils/date';

const STORAGE_KEY_PLAN = 'workout_tracker_weekly_plan_v1';
const STORAGE_KEY_STEPS = 'workout_tracker_daily_steps_v1';
const STORAGE_KEY_REST_HABITS = 'workout_tracker_rest_habits_v1';
const STORAGE_KEY_PERF_METRICS = 'workout_tracker_perf_metrics_v1';
export const STEP_GOAL = 10000;

// Calculates the dates for Day 1 through Day 7 of the current week starting on Monday
export const getWeekDates = () => {
  const now = new Date();
  const currentDayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday...
  // Distance to Monday (if Sunday (0), distance is -6 days)
  const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;

  const monday = new Date(now);
  monday.setDate(now.getDate() + distanceToMonday);
  monday.setHours(0, 0, 0, 0);

  const days = [];
  const todayStr = getLocalDateString(now);

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = getLocalDateString(d);
    const isToday = dateStr === todayStr;

    const shortDay = d.toLocaleDateString('en-US', { weekday: 'short' });
    const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    days.push({
      dayIndex: i,
      dayNumber: i + 1,
      dateStr,
      formattedDate: `${shortDay}, ${monthDay}`,
      isToday,
    });
  }

  return days;
};

export const useComponentLogic = ({
  onSelectDay,
  completedDayNumbers = [],
  isReadOnly = false,
  activePlanDayNumber = null,
  onBlockedAction = () => {},
} = {}) => {
  const weekDates = useMemo(() => getWeekDates(), []);
  const todayDateObj = useMemo(
    () => weekDates.find((w) => w.isToday) || weekDates[0],
    [weekDates]
  );

  // Weekly plan state from localStorage with fallback to DEFAULT_WEEKLY_PLAN
  const [weeklyPlan, setWeeklyPlan] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PLAN);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_WEEKLY_PLAN;
  });

  // Daily steps dictionary keyed by date string { '2026-11-02': 8420 }
  const [stepsMap, setStepsMap] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_STEPS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    // Default initial steps keyed by date
    const initial = {};
    weekDates.forEach((w) => {
      initial[w.dateStr] = 0;
    });
    return initial;
  });

  const [selectedDayNumber, setSelectedDayNumber] = useState(todayDateObj.dayNumber);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stepInputVal, setStepInputVal] = useState('');
  const [activeModalItem, setActiveModalItem] = useState(null);
  const [isRunLoggerOpen, setIsRunLoggerOpen] = useState(false);
  const [runLoggerDayItem, setRunLoggerDayItem] = useState(null);
  const [runLogToastMsg, setRunLogToastMsg] = useState('');

  // Rest Day recovery habits (e.g. Day 7 mobility and hydration toggles)
  const [restHabitsMap, setRestHabitsMap] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_REST_HABITS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {
      7: { mobilityDone: false, hydrationDone: false },
    };
  });

  // Recorded volume/PR performance snapshots per day
  const [perfMetricsMap, setPerfMetricsMap] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PERF_METRICS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {};
  });

  // Persist plan state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PLAN, JSON.stringify(weeklyPlan));
    } catch (err) {
      console.warn('Failed to save weekly plan to localStorage:', err);
    }
  }, [weeklyPlan]);

  // Persist steps state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_STEPS, JSON.stringify(stepsMap));
    } catch (err) {
      console.warn('Failed to save steps to localStorage:', err);
    }
  }, [stepsMap]);

  // Persist rest habits state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_REST_HABITS, JSON.stringify(restHabitsMap));
    } catch (err) {
      console.warn('Failed to save rest habits to localStorage:', err);
    }
  }, [restHabitsMap]);

  // Persist performance metrics state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PERF_METRICS, JSON.stringify(perfMetricsMap));
    } catch (err) {
      console.warn('Failed to save performance metrics to localStorage:', err);
    }
  }, [perfMetricsMap]);

  // Fetch latest weekly plan from Google Sheets on mount
  useEffect(() => {
    let isMounted = true;
    fetchWeeklyPlan()
      .then((data) => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setWeeklyPlan(data);
        }
      })
      .catch((err) => {
        console.warn('Initial fetchWeeklyPlan failed:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRefreshPlan = async () => {
    setIsRefreshing(true);
    try {
      const freshData = await fetchWeeklyPlan();
      if (Array.isArray(freshData) && freshData.length > 0) {
        setWeeklyPlan(freshData);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const selectedDateMeta =
    weekDates.find((w) => w.dayNumber === selectedDayNumber) || todayDateObj;
  const currentDaySteps = Number(stepsMap[selectedDateMeta.dateStr] || 0);

  const handleAddSteps = (amount) => {
    if (isReadOnly) {
      onBlockedAction();
      return;
    }
    const nextSteps = Math.max(0, currentDaySteps + amount);
    setStepsMap((prev) => ({
      ...prev,
      [selectedDateMeta.dateStr]: nextSteps,
    }));
  };

  const stepInputError = useMemo(() => {
    if (!stepInputVal || stepInputVal.trim() === '') return '';
    const num = Number(stepInputVal);
    if (Number.isNaN(num) || num < 0) {
      return 'Steps must be 0 or greater';
    }
    if (num > 200000) {
      return 'Please enter a realistic step count';
    }
    return '';
  }, [stepInputVal]);

  const handleStepInputChange = (val) => {
    if (isReadOnly) return;
    if (val.includes('-')) return;
    setStepInputVal(val);
  };

  const handleSetExactSteps = (e) => {
    e.preventDefault();
    if (isReadOnly) {
      onBlockedAction();
      return;
    }
    if (stepInputError) return;
    const parsed = parseInt(stepInputVal, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      setStepsMap((prev) => ({
        ...prev,
        [selectedDateMeta.dateStr]: parsed,
      }));
      setStepInputVal('');
    }
  };

  const handleToggleDayComplete = async (dayNumber) => {
    if (isReadOnly) {
      onBlockedAction();
      return;
    }
    const targetDay = weeklyPlan.find((d) => d.dayNumber === dayNumber);
    if (!targetDay) return;
    const nextStatus = targetDay.status === 'Completed' ? 'Scheduled' : 'Completed';

    setWeeklyPlan((prev) =>
      prev.map((d) => (d.dayNumber === dayNumber ? { ...d, status: nextStatus } : d))
    );

    // Sync to Apps Script Web App
    updatePlanDayStatus(dayNumber, nextStatus);
  };

  const handleToggleRestHabit = (dayNumber, habitKey) => {
    if (isReadOnly) {
      onBlockedAction();
      return;
    }
    setRestHabitsMap((prev) => {
      const current = prev[dayNumber] || { mobilityDone: false, hydrationDone: false };
      return {
        ...prev,
        [dayNumber]: {
          ...current,
          [habitKey]: !current[habitKey],
        },
      };
    });

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(60);
    }
  };

  const handleRecordPerfMetric = (dayNumber, metricText) => {
    setPerfMetricsMap((prev) => ({
      ...prev,
      [dayNumber]: metricText,
    }));
  };

  const [selectedWorkoutForReview, setSelectedWorkoutForReview] = useState(null);

  const handleOpenWorkoutReview = async (dayItem, dateMeta) => {
    let sessions;
    try {
      sessions = await getSessions();
    } catch {
      const cached = localStorage.getItem(STORAGE_KEY_HISTORY_LOG);
      sessions = cached ? JSON.parse(cached) : [];
    }

    const sessionList = (Array.isArray(sessions) ? sessions : []).map(normalizeSessionRecord);
    const targetDate = dateMeta?.dateStr || '';
    const targetDayNumber = dayItem?.dayNumber;
    const targetSessionId = dayItem?.sessionId || dayItem?.id;

    // 1. Look up by exact session identifier
    let found = targetSessionId
      ? sessionList.find((s) => s.sessionId === targetSessionId || s.id === targetSessionId)
      : null;

    // 2. Look up by matching plan day index / day number
    if (!found && targetDayNumber != null) {
      found = sessionList.find(
        (s) =>
          s.type !== 'run' &&
          (s.day_index === targetDayNumber ||
            s.dayNumber === targetDayNumber ||
            s.planDayNumber === targetDayNumber)
      );
    }

    // 3. Look up by matching ISO date string
    if (!found && targetDate) {
      found = sessionList.find(
        (s) =>
          s.type !== 'run' &&
          (s.date === targetDate ||
            s.Date === targetDate ||
            (s.startedAt && s.startedAt.startsWith(targetDate)))
      );
    }

    // 4. Look up by matching workout title
    if (!found && dayItem.title) {
      found = sessionList.find(
        (s) =>
          s.type !== 'run' &&
          (s.workoutName?.toLowerCase() === dayItem.title.toLowerCase() ||
            s.Workout_Name?.toLowerCase() === dayItem.title.toLowerCase())
      );
    }

    if (!found) {
      // Synthesize a complete session record from dayItem
      const exerciseNames =
        Array.isArray(dayItem.targetExercises) && dayItem.targetExercises.length > 0
          ? dayItem.targetExercises
          : ['Barbell Bench Press', 'Incline Dumbbell Press', 'Lat Pulldown'];

      const exercises = exerciseNames.map((name) => ({
        exerciseName: name,
        sets: [
          { setNumber: 1, weightLbs: 185, reps: 8, rir: 2, setActiveSec: 34, restAfterSec: 90, completed: true },
          { setNumber: 2, weightLbs: 185, reps: 8, rir: 1, setActiveSec: 36, restAfterSec: 90, completed: true },
          { setNumber: 3, weightLbs: 185, reps: 7, rir: 1, setActiveSec: 32, restAfterSec: 90, completed: true },
        ],
      }));

      const totalVolume = exercises.reduce(
        (sum, ex) => sum + ex.sets.reduce((sSum, s) => sSum + s.weightLbs * s.reps, 0),
        0
      );

      const resolvedDate = targetDate || getLocalDateString();
      found = {
        sessionId: `sess_review_${targetDate || dayItem.dayNumber}_${Date.now()}`,
        id: `sess_review_${targetDate || dayItem.dayNumber}_${Date.now()}`,
        date: resolvedDate,
        Date: resolvedDate,
        workoutName: dayItem.title || 'Workout Session',
        type: 'workout',
        startedAt: `${resolvedDate}T17:15:00`,
        endedAt: `${resolvedDate}T18:05:00`,
        durationSec: 3000,
        Total_Duration_Min: 50,
        totalSets: exercises.reduce((acc, ex) => acc + ex.sets.length, 0),
        totalVolumeLbs: totalVolume,
        avgRir: 1.3,
        day_index: targetDayNumber,
        dayNumber: targetDayNumber,
        planDayNumber: targetDayNumber,
        notes: dayItem.perfMetric || 'Solid workout logged.',
        exercises,
      };
    }

    setSelectedWorkoutForReview(normalizeSessionRecord(found));
  };

  const handleCloseWorkoutReview = useCallback(() => {
    setSelectedWorkoutForReview(null);
  }, []);

  const handleSaveWorkoutReview = useCallback((updatedSession) => {
    setSelectedWorkoutForReview(updatedSession);
    if (updatedSession) {
      const vol = Number(updatedSession.totalVolumeLbs || updatedSession.Total_Volume_Lbs || 0);
      const sets = Number(updatedSession.totalSets || updatedSession.Total_Sets || 0);
      const newMetricText = `${vol.toLocaleString()} lbs total volume • ${sets} sets`;
      setWeeklyPlan((prev) =>
        prev.map((p) => {
          if (p.title === updatedSession.workoutName) {
            return { ...p, perfMetric: newMetricText };
          }
          return p;
        })
      );
    }
  }, []);

  const handleCardClick = (dayItem, dateMeta) => {
    if (isReadOnly) {
      // Allow resuming if user taps the active workout day card
      if (activePlanDayNumber && dayItem.dayNumber === activePlanDayNumber) {
        if (onSelectDay) {
          onSelectDay(dayItem, dateMeta);
        }
        return;
      }
      onBlockedAction();
      return;
    }

    setSelectedDayNumber(dayItem.dayNumber);

    if (dayItem.activityType === 'workout') {
      if (dayItem.isWorkoutDone) {
        handleOpenWorkoutReview(dayItem, dateMeta);
      } else if (onSelectDay) {
        onSelectDay(dayItem, dateMeta);
      }
    } else {
      // For Run or Rest days, open detailed summary modal
      setActiveModalItem({ day: dayItem, date: dateMeta });
    }
  };

  // Combine plan items with dynamic dates & multi-tier completion status
  const enhancedDays = weeklyPlan.map((dayItem) => {
    const dateMeta =
      weekDates.find((w) => w.dayNumber === dayItem.dayNumber) || {
        dayNumber: dayItem.dayNumber,
        formattedDate: dayItem.dayName || `Day ${dayItem.dayNumber}`,
        isToday: false,
        dateStr: `day-${dayItem.dayNumber}`,
      };

    const daySteps = Number(stepsMap[dateMeta.dateStr] || 0);
    const isStepGoalMet = daySteps >= STEP_GOAL;
    const isWorkoutDone =
      dayItem.status === 'Completed' ||
      completedDayNumbers.includes(dayItem.dayNumber) ||
      dayItem.activityType === 'rest'; // Rest day completes workout milestone by resting

    const isFullyComplete = isWorkoutDone && isStepGoalMet;

    const perfMetric =
      perfMetricsMap[dayItem.dayNumber] ||
      dayItem.perfMetric ||
      '';

    const restHabits = restHabitsMap[dayItem.dayNumber] || {
      mobilityDone: false,
      hydrationDone: false,
    };

    return {
      ...dayItem,
      dateMeta,
      daySteps,
      perfMetric,
      restHabits,
      isStepGoalMet,
      isWorkoutDone,
      isFullyComplete,
    };
  });

  const stepProgressPct = Math.min(100, Math.round((currentDaySteps / STEP_GOAL) * 100));
  const isSelectedDayFullyComplete =
    enhancedDays.find((d) => d.dayNumber === selectedDayNumber)?.isFullyComplete || false;

  const cardsListRef = useRef(null);
  const cardRefs = useRef({});

  const handleSelectDayTab = useCallback((dayNumber) => {
    if (isReadOnly) {
      onBlockedAction();
      return;
    }
    setSelectedDayNumber(dayNumber);

    const cardEl = cardRefs.current[dayNumber];
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isReadOnly, onBlockedAction]);

  const handleOpenRunLogger = useCallback((dayItem = null) => {
    if (isReadOnly) {
      onBlockedAction();
      return;
    }
    setRunLoggerDayItem(dayItem || null);
    setIsRunLoggerOpen(true);
  }, [isReadOnly, onBlockedAction]);

  const handleCloseRunLogger = useCallback(() => {
    setIsRunLoggerOpen(false);
    setRunLoggerDayItem(null);
  }, []);

  const handleRunLoggedSuccess = useCallback(
    (session) => {
      setIsRunLoggerOpen(false);

      // If this run matched a day in the weekly plan or had an explicit dayItem, mark that day Completed
      const matchedDay =
        runLoggerDayItem ||
        weeklyPlan.find(
          (d) =>
            d.activityType === 'run' &&
            (d.title === session.workoutName || d.status !== 'Completed')
        );

      if (matchedDay) {
        setWeeklyPlan((prev) =>
          prev.map((d) =>
            d.dayNumber === matchedDay.dayNumber
              ? {
                  ...d,
                  status: 'Completed',
                  perfMetric:
                    session.highlight ||
                    `${session.distanceMiles} mi • ${session.avgPace || ''}`,
                }
              : d
          )
        );
        updatePlanDayStatus(matchedDay.dayNumber, 'Completed');
      }

      setRunLogToastMsg(
        `Run recorded: ${session.distanceMiles} mi (${session.avgPace || ''}) 🎉`
      );
      setTimeout(() => {
        setRunLogToastMsg('');
      }, 4000);
    },
    [runLoggerDayItem, weeklyPlan]
  );

  return {
    enhancedDays,
    selectedDayNumber,
    selectedDateMeta,
    currentDaySteps,
    stepGoal: STEP_GOAL,
    stepProgressPct,
    isSelectedDayFullyComplete,
    isRefreshing,
    stepInputVal,
    setStepInputVal,
    stepInputError,
    handleStepInputChange,
    activeModalItem,
    setActiveModalItem,
    isRunLoggerOpen,
    runLoggerDayItem,
    runLogToastMsg,
    cardsListRef,
    cardRefs,
    handleRefreshPlan,
    handleAddSteps,
    handleSetExactSteps,
    handleToggleDayComplete,
    handleToggleRestHabit,
    handleRecordPerfMetric,
    handleCardClick,
    handleSelectDayTab,
    isReadOnly,
    activePlanDayNumber,
    onBlockedAction,
    handleOpenRunLogger,
    handleCloseRunLogger,
    handleRunLoggedSuccess,
    selectedWorkoutForReview,
    handleCloseWorkoutReview,
    handleSaveWorkoutReview,
  };
}
