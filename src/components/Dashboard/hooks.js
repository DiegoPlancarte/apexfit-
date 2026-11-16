import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  DEFAULT_WEEKLY_PLAN,
  fetchWeeklyPlan,
  pullLatestBackendData,
  updatePlanDayStatus,
  normalizeWeeklyPlan,
  STORAGE_KEY_PLAN,
  STORAGE_KEY_STEPS,
  STORAGE_KEY_HISTORY_LOG,
  normalizeSessionRecord,
  reconcileAndMergeSessions,
  isWearableSource,
  getApiUrl,
} from '../../services/api';
import {
  getSessions,
  revalidateSessionsAgainstPlan,
} from '../../services/db';
import { getLocalDateString, parseLocalDate } from '../../utils/date';

const STORAGE_KEY_REST_HABITS = 'workout_tracker_rest_habits_v1';
const STORAGE_KEY_PERF_METRICS = 'workout_tracker_perf_metrics_v1';
export const STEP_GOAL = 10000;

// Calculates the dates for Day 1 through Day 7 of the current week starting on Monday
export const getWeekDates = (baseDate = new Date(), overrideTodayStr = null) => {
  const d = parseLocalDate(baseDate);
  const currentDayOfWeek = d.getDay(); // 0 is Sunday, 1 is Monday...
  // Distance to Monday (if Sunday (0), distance is -6 days)
  const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;

  const monday = new Date(d);
  monday.setDate(d.getDate() + distanceToMonday);
  monday.setHours(0, 0, 0, 0);

  const days = [];
  const todayStr = overrideTodayStr || getLocalDateString(new Date());

  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    const dateStr = getLocalDateString(cur);
    const isToday = dateStr === todayStr;

    const shortDay = cur.toLocaleDateString('en-US', { weekday: 'short' });
    const monthDay = cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

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

/**
 * Checks whether a session's activity type is compatible with a planned day item.
 *
 * @param {Object} session
 * @param {Object} dayItem
 * @returns {boolean}
 */
export const isSessionCompatibleWithPlanDay = (session, dayItem) => {
  if (!session || !dayItem || dayItem.activityType === 'rest') return false;
  const sType = String(session.type || session.Workout_Type || 'workout').toLowerCase().trim();
  const planActivity = String(dayItem.activityType || 'workout').toLowerCase().trim();
  const rawPlanActivity = String(dayItem.Activity_Type || dayItem.title || '').toLowerCase();

  if (planActivity === 'run') {
    if (rawPlanActivity.includes('walk')) {
      return sType === 'walk' || sType === 'run';
    }
    return sType === 'run' || session.Workout_Type === 'Run';
  }

  if (planActivity === 'workout') {
    if (sType === 'run' || sType === 'walk' || sType === 'pickleball' || sType === 'cardio') {
      return false;
    }
    if (session.Workout_Type === 'Run' || session.Workout_Type === 'Walk') {
      return false;
    }
    // Passive wearable-only entries with zero sets and zero volume should not complete a lifting plan card
    if (isWearableSource(session) && !session.isMergedTelemetry) {
      const setsCount =
        Number(session.totalSets ?? session.Total_Sets ?? 0) ||
        (Array.isArray(session.exercises)
          ? session.exercises.reduce((acc, ex) => acc + (ex.sets?.length || 0), 0)
          : 0);
      const vol = Number(session.totalVolumeLbs ?? session.Total_Volume_Lbs ?? 0);
      if (setsCount === 0 && vol === 0) return false;
    }
    return true;
  }

  return false;
};

/**
 * Strictly matches a completed session record to a scheduled plan card within the active week's date bounds.
 * Prevents falling back to historical or cross-week session references when dayNumber or workout title collide.
 *
 * @param {Object} dayItem
 * @param {Object} dateMeta
 * @param {Array<Object>} sessionsList
 * @param {Set<string>} [weekDateSet]
 * @returns {Object|null}
 */
export const matchSessionToPlanDay = (
  dayItem,
  dateMeta,
  sessionsList = [],
  weekDateSet = null
) => {
  if (!dayItem || dayItem.activityType === 'rest' || !Array.isArray(sessionsList) || sessionsList.length === 0) {
    return null;
  }

  const targetDate = String(
    dayItem.date || dayItem.Date || dateMeta?.dateStr || ''
  ).trim();

  // Require a valid ISO calendar date within the active week bounds
  if (!targetDate || targetDate.startsWith('day-')) {
    return null;
  }
  if (weekDateSet instanceof Set && !weekDateSet.has(targetDate)) {
    return null;
  }

  // Filter candidate sessions strictly to the active week's date bounds AND the card's target date
  const dateBoundedCandidates = sessionsList.filter((s) => {
    if (!s || typeof s !== 'object') return false;
    const sessDate =
      s.date || s.Date || (s.startedAt ? getLocalDateString(s.startedAt) : '');
    if (!sessDate) return false;
    if (weekDateSet instanceof Set && !weekDateSet.has(sessDate)) return false;
    return sessDate === targetDate;
  });

  if (dateBoundedCandidates.length === 0) {
    return null;
  }

  // 1. Explicit session ID match (must still reside within active week date bounds on targetDate)
  const targetSessionId = String(
    dayItem.completedWorkoutId ||
      dayItem.Completed_Workout_ID ||
      dayItem.sessionId ||
      dayItem.id ||
      ''
  ).trim();

  if (targetSessionId) {
    const idMatch = dateBoundedCandidates.find(
      (s) =>
        s.sessionId === targetSessionId ||
        s.Workout_ID === targetSessionId ||
        s.id === targetSessionId
    );
    if (idMatch) return idMatch;
  }

  const compatibleCandidates = dateBoundedCandidates.filter((s) =>
    isSessionCompatibleWithPlanDay(s, dayItem)
  );

  if (compatibleCandidates.length === 0) {
    return null;
  }

  // 2. Same-date match with matching plan dayNumber or workout title
  const targetDayNumber = dayItem.dayNumber ?? dayItem.Day_Number;
  const targetTitle = String(dayItem.title || dayItem.Workout_Title || '')
    .toLowerCase()
    .trim();

  const specificMatch = compatibleCandidates.find((s) => {
    const sessDayNumber = s.dayNumber ?? s.day_index ?? s.planDayNumber;
    if (targetDayNumber != null && sessDayNumber != null && Number(sessDayNumber) === Number(targetDayNumber)) {
      return true;
    }
    const sName = String(s.workoutName || s.Workout_Name || '')
      .toLowerCase()
      .trim();
    if (targetTitle && sName && sName === targetTitle) {
      return true;
    }
    return false;
  });

  if (specificMatch) {
    return specificMatch;
  }

  // 3. Same-date compatible activity match
  return compatibleCandidates[0] || null;
};

export const formatWeekRange = (mondayDate) => {
  if (!mondayDate) return '';
  const d1 = new Date(mondayDate);
  const d2 = new Date(mondayDate);
  d2.setDate(d1.getDate() + 6);

  const m1 = d1.toLocaleDateString('en-US', { month: 'short' });
  const m2 = d2.toLocaleDateString('en-US', { month: 'short' });
  const y = d2.getFullYear();

  if (m1 === m2) {
    return `${m1} ${d1.getDate()} – ${d2.getDate()}, ${y}`;
  }
  return `${m1} ${d1.getDate()} – ${m2} ${d2.getDate()}, ${y}`;
};

export const useComponentLogic = ({
  onSelectDay,
  completedDayNumbers = [],
  isReadOnly = false,
  activePlanDayNumber = null,
  onBlockedAction = () => {},
} = {}) => {
  const [todayStr, setTodayStr] = useState(() => getLocalDateString(new Date()));

  // Current Monday for 7-day week window navigation
  const [currentMonday, setCurrentMonday] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const dist = day === 0 ? -6 : 1 - day;
    const m = new Date(now);
    m.setDate(now.getDate() + dist);
    m.setHours(0, 0, 0, 0);
    return m;
  });

  const weekDates = useMemo(
    () => getWeekDates(currentMonday, todayStr),
    [currentMonday, todayStr]
  );
  const todayDateObj = useMemo(
    () => weekDates.find((w) => w.isToday) || weekDates[0],
    [weekDates]
  );

  const thisMonday = useMemo(() => {
    const now = parseLocalDate(todayStr);
    const day = now.getDay();
    const dist = day === 0 ? -6 : 1 - day;
    const m = new Date(now);
    m.setDate(now.getDate() + dist);
    m.setHours(0, 0, 0, 0);
    return m;
  }, [todayStr]);

  const isCurrentWeek = useMemo(() => {
    return currentMonday.getTime() === thisMonday.getTime();
  }, [currentMonday, thisMonday]);

  const isPastWeek = useMemo(() => {
    return currentMonday.getTime() < thisMonday.getTime();
  }, [currentMonday, thisMonday]);

  const isFutureWeek = useMemo(() => {
    return currentMonday.getTime() > thisMonday.getTime();
  }, [currentMonday, thisMonday]);

  const weekRangeDisplay = useMemo(
    () => formatWeekRange(currentMonday),
    [currentMonday]
  );

  const handlePrevWeek = useCallback(() => {
    if (isReadOnly) return;
    setCurrentMonday((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() - 7);
      return next;
    });
  }, [isReadOnly]);

  const handleNextWeek = useCallback(() => {
    if (isReadOnly) return;
    setCurrentMonday((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + 7);
      return next;
    });
  }, [isReadOnly]);

  const handleJumpToCurrentWeek = useCallback(() => {
    if (isReadOnly) return;
    const now = new Date();
    const day = now.getDay();
    const dist = day === 0 ? -6 : 1 - day;
    const m = new Date(now);
    m.setDate(now.getDate() + dist);
    m.setHours(0, 0, 0, 0);
    setCurrentMonday(m);
  }, [isReadOnly]);

  // Weekly plan state from localStorage with fallback to DEFAULT_WEEKLY_PLAN
  const [weeklyPlan, setWeeklyPlan] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PLAN);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return normalizeWeeklyPlan(parsed);
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

  // Load weekly plan from local cache on mount (zero network calls on navigation)
  useEffect(() => {
    let isMounted = true;
    fetchWeeklyPlan({ forceNetwork: false })
      .then((data) => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setWeeklyPlan(data);
        }
      })
      .catch((err) => {
        console.warn('Initial fetchWeeklyPlan fallback:', err);
      });

    const handleStepsUpdated = (e) => {
      if (e?.detail) {
        setStepsMap((prev) => ({
          ...prev,
          ...e.detail,
        }));
      }
    };

    const handlePlanUpdated = (e) => {
      if (Array.isArray(e?.detail) && e.detail.length > 0) {
        setWeeklyPlan(normalizeWeeklyPlan(e.detail));
      }
    };

    const handleCacheInvalidated = () => {
      try {
        const savedMetrics = localStorage.getItem(STORAGE_KEY_PERF_METRICS);
        setPerfMetricsMap(savedMetrics ? JSON.parse(savedMetrics) : {});
      } catch {
        setPerfMetricsMap({});
      }
      try {
        const savedHabits = localStorage.getItem(STORAGE_KEY_REST_HABITS);
        if (savedHabits) setRestHabitsMap(JSON.parse(savedHabits));
      } catch {
        // ignore
      }
      try {
        const savedPlan = localStorage.getItem(STORAGE_KEY_PLAN);
        if (savedPlan) {
          const parsed = JSON.parse(savedPlan);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setWeeklyPlan(normalizeWeeklyPlan(parsed));
          }
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('apexfit:steps-updated', handleStepsUpdated);
    window.addEventListener('apexfit:plan-updated', handlePlanUpdated);
    window.addEventListener('apexfit:cache-invalidated', handleCacheInvalidated);

    return () => {
      isMounted = false;
      window.removeEventListener('apexfit:steps-updated', handleStepsUpdated);
      window.removeEventListener('apexfit:plan-updated', handlePlanUpdated);
      window.removeEventListener('apexfit:cache-invalidated', handleCacheInvalidated);
    };
  }, []);

  // Hydrate local sessions to auto-sync completed workouts & runs into dashboard cards
  const [loggedSessions, setLoggedSessions] = useState([]);

  const refreshLoggedSessions = useCallback(async () => {
    try {
      const records = await getSessions();
      if (Array.isArray(records)) {
        setLoggedSessions(reconcileAndMergeSessions(records).map(normalizeSessionRecord));
        return;
      }
    } catch {
      // fallback to history log cache
    }
    try {
      const cached = localStorage.getItem(STORAGE_KEY_HISTORY_LOG);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setLoggedSessions(reconcileAndMergeSessions(parsed).map(normalizeSessionRecord));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    getSessions()
      .then((records) => {
        if (isMounted && Array.isArray(records)) {
          setLoggedSessions(reconcileAndMergeSessions(records).map(normalizeSessionRecord));
        }
      })
      .catch(() => {
        try {
          const cached = localStorage.getItem(STORAGE_KEY_HISTORY_LOG);
          if (cached && isMounted) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              setLoggedSessions(reconcileAndMergeSessions(parsed).map(normalizeSessionRecord));
            }
          }
        } catch {
          // ignore
        }
      });

    const handleSync = () => refreshLoggedSessions();
    const handleForegroundSync = async () => {
      const latestToday = getLocalDateString(new Date());
      if (latestToday !== todayStr) {
        setTodayStr(latestToday);
        const now = parseLocalDate(latestToday);
        const day = now.getDay();
        const dist = day === 0 ? -6 : 1 - day;
        const nextMon = new Date(now);
        nextMon.setDate(now.getDate() + dist);
        nextMon.setHours(0, 0, 0, 0);
        setCurrentMonday(nextMon);
        setSelectedDayNumber(day === 0 ? 7 : day);
      }
      await revalidateSessionsAgainstPlan();
      if (typeof navigator !== 'undefined' && navigator.onLine && getApiUrl()) {
        await pullLatestBackendData().catch(() => {});
      }
      refreshLoggedSessions();
    };

    window.addEventListener('apexfit:sync-flushed', handleSync);
    window.addEventListener('apexfit:session-updated', handleSync);
    window.addEventListener('apexfit:run-logged', handleSync);
    window.addEventListener('apexfit:plan-updated', handleSync);
    window.addEventListener('apexfit:cache-invalidated', handleSync);
    window.addEventListener('apexfit:app-foregrounded', handleForegroundSync);

    return () => {
      isMounted = false;
      window.removeEventListener('apexfit:sync-flushed', handleSync);
      window.removeEventListener('apexfit:session-updated', handleSync);
      window.removeEventListener('apexfit:run-logged', handleSync);
      window.removeEventListener('apexfit:plan-updated', handleSync);
      window.removeEventListener('apexfit:cache-invalidated', handleSync);
      window.removeEventListener('apexfit:app-foregrounded', handleForegroundSync);
    };
  }, [refreshLoggedSessions, todayStr]);

  const handleRefreshPlan = async () => {
    setIsRefreshing(true);
    try {
      const freshData = await fetchWeeklyPlan({ forceNetwork: true });
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
    const targetDateStr = weekDates.find((w) => w.dayNumber === dayNumber)?.dateStr || '';
    const targetDay =
      (targetDateStr &&
        weeklyPlan.find((d) => (d.date || d.Date) === targetDateStr)) ||
      weeklyPlan.find((d) => !(d.date || d.Date) && d.dayNumber === dayNumber) ||
      weeklyPlan.find((d) => d.dayNumber === dayNumber);
    if (!targetDay) return;
    const nextStatus = targetDay.status === 'Completed' ? 'Scheduled' : 'Completed';

    setWeeklyPlan((prev) =>
      prev.map((d) => {
        const dDate = d.date || d.Date;
        if (targetDateStr && dDate) {
          return dDate === targetDateStr ? { ...d, status: nextStatus, Status: nextStatus } : d;
        }
        return d.dayNumber === dayNumber ? { ...d, status: nextStatus, Status: nextStatus } : d;
      })
    );

    // Sync to Apps Script Web App
    updatePlanDayStatus(dayNumber, nextStatus, undefined, { date: targetDateStr });
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

  // Resolve plan and session data strictly for this week window (no duplicate bleeding into adjacent weeks)
  const weekDateSet = useMemo(() => new Set(weekDates.map((w) => w.dateStr)), [weekDates]);

  const [selectedWorkoutForReview, setSelectedWorkoutForReview] = useState(null);

  const handleOpenWorkoutReview = async (dayItem, dateMeta) => {
    let sessions;
    try {
      sessions = await getSessions();
    } catch {
      const cached = localStorage.getItem(STORAGE_KEY_HISTORY_LOG);
      sessions = cached ? JSON.parse(cached) : [];
    }

    const rawSessions = Array.isArray(sessions) ? sessions : [];
    const sessionList = reconcileAndMergeSessions(rawSessions).map(normalizeSessionRecord);
    const targetDate = dateMeta?.dateStr || dayItem?.date || dayItem?.Date || '';
    const targetDayNumber = dayItem?.dayNumber;

    // Strictly match within the active week's date bounds (never fall back to historical sessions from other weeks)
    let found = matchSessionToPlanDay(dayItem, dateMeta, sessionList, weekDateSet);

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
      const syntheticId = `sess_review_${resolvedDate || dayItem.dayNumber}`;
      found = {
        sessionId: syntheticId,
        id: syntheticId,
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

  const [selectedRunForDetails, setSelectedRunForDetails] = useState(null);

  const handleOpenRunDetails = async (dayItem, dateMeta) => {
    let rawSessions;
    try {
      rawSessions = await getSessions();
    } catch {
      const cached = localStorage.getItem(STORAGE_KEY_HISTORY_LOG);
      rawSessions = cached ? JSON.parse(cached) : [];
    }

    const list = Array.isArray(rawSessions) ? rawSessions : [];
    const sessionList = reconcileAndMergeSessions(list).map(normalizeSessionRecord);

    // Strictly match within the active week's date bounds
    const found = matchSessionToPlanDay(dayItem, dateMeta, sessionList, weekDateSet);

    if (found) {
      setSelectedRunForDetails(found);
    } else {
      // Fallback: open clean run logger for this day
      handleOpenRunLogger(dayItem);
    }
  };

  const handleCloseRunDetails = useCallback(() => {
    setSelectedRunForDetails(null);
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
    } else if (dayItem.activityType === 'run') {
      if (dayItem.isWorkoutDone) {
        handleOpenRunDetails(dayItem, dateMeta);
      } else {
        handleOpenRunLogger(dayItem);
      }
    } else {
      // For Rest days, open detailed summary modal
      setActiveModalItem({ day: dayItem, date: dateMeta });
    }
  };

  const weekSessions = useMemo(() => {
    if (!Array.isArray(loggedSessions)) return [];
    return loggedSessions.filter((s) => {
      const sDate = s.date || s.Date || (s.startedAt ? s.startedAt.split('T')[0] : '');
      return sDate && weekDateSet.has(sDate);
    });
  }, [loggedSessions, weekDateSet]);

  const rawWeekPlan = useMemo(() => {
    if (!Array.isArray(weeklyPlan)) return [];

    // 1. If any plan items have explicit calendar dates matching this week, return them
    const datedItems = weeklyPlan.filter((item) => {
      const itemDate = item.date || item.Date;
      return itemDate && weekDateSet.has(itemDate);
    });

    if (datedItems.length > 0) {
      return datedItems;
    }

    // 2. Generic undated plan items belong ONLY to the active current week
    if (isCurrentWeek) {
      const undatedItems = weeklyPlan.filter((item) => !(item.date || item.Date));
      if (undatedItems.length > 0) {
        return undatedItems;
      }
      // If weeklyPlan only had dated items from a stale/different week, strip stale dates and reset completion state
      return weeklyPlan.map((item) => ({
        ...item,
        date: undefined,
        Date: undefined,
        status: 'Scheduled',
        Status: 'Scheduled',
        completedWorkoutId: undefined,
        Completed_Workout_ID: undefined,
        perfMetric: '',
      }));
    }

    // 3. For adjacent past/future weeks without dedicated plan records, do NOT duplicate
    return [];
  }, [weeklyPlan, weekDateSet, isCurrentWeek]);

  // Combine plan items with dynamic dates & multi-tier completion status
  const enhancedDays = useMemo(() => {
    if (rawWeekPlan.length > 0) {
      return rawWeekPlan.map((dayItem) => {
        const dateMeta =
          weekDates.find((w) => (dayItem.date && w.dateStr === dayItem.date) || w.dayNumber === dayItem.dayNumber) || {
            dayNumber: dayItem.dayNumber,
            formattedDate: dayItem.dayName || `Day ${dayItem.dayNumber}`,
            isToday: false,
            dateStr: `day-${dayItem.dayNumber}`,
          };

        const daySteps = Number(stepsMap[dateMeta.dateStr] || 0);
        const isStepGoalMet = daySteps >= STEP_GOAL;
        const isRest = dayItem.activityType === 'rest';

        // Strictly match completed session within this week's active date bounds
        const matchingSession = matchSessionToPlanDay(
          dayItem,
          dateMeta,
          weekSessions,
          weekDateSet
        );

        const hasExplicitBackendDate = Boolean(dayItem.date || dayItem.Date);
        const isExplicitlyScheduledOnDate =
          hasExplicitBackendDate &&
          String(dayItem.status ?? dayItem.Status ?? 'Scheduled').toLowerCase() === 'scheduled' &&
          !(dayItem.completedWorkoutId || dayItem.Completed_Workout_ID);

        const isWorkoutDone =
          dayItem.status === 'Completed' ||
          Boolean(matchingSession) ||
          (isCurrentWeek &&
            !isExplicitlyScheduledOnDate &&
            completedDayNumbers.includes(dayItem.dayNumber)) ||
          isRest;

        const isFullyComplete = isWorkoutDone && isStepGoalMet;

        let derivedPerf =
          (isWorkoutDone
            ? perfMetricsMap[dateMeta.dateStr] ||
              (!hasExplicitBackendDate && isCurrentWeek ? perfMetricsMap[dayItem.dayNumber] : '') ||
              dayItem.perfMetric
            : '') || '';
        if (!derivedPerf && matchingSession) {
          if (matchingSession.type === 'run' || matchingSession.Workout_Type === 'Run') {
            const dist = matchingSession.distanceMiles || matchingSession.distance || 0;
            const pace = matchingSession.avgPace || '';
            const elev = matchingSession.elevationGainFt ? ` • ⛰️ +${Math.round(matchingSession.elevationGainFt)} ft` : '';
            derivedPerf = `${dist} mi${pace ? ' • ' + pace : ''}${elev}`;
          } else {
            const vol = Number(matchingSession.totalVolumeLbs || matchingSession.Total_Volume_Lbs || 0);
            const sets = Number(
              matchingSession.totalSets ||
                matchingSession.Total_Sets ||
                (matchingSession.exercises ? matchingSession.exercises.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0) : 0)
            );
            if (vol > 0 || sets > 0) {
              derivedPerf = `${vol.toLocaleString()} lbs total volume • ${sets} sets`;
            }
          }
        }

        const perfMetric = derivedPerf;
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
    }

    // If past week has logged sessions but no standalone plan, render days from logged sessions
    if (isPastWeek && weekSessions.length > 0) {
      return weekSessions.map((session, sIdx) => {
        const sessDate = session.date || session.Date || (session.startedAt ? session.startedAt.split('T')[0] : '');
        const dateMeta = weekDates.find((w) => w.dateStr === sessDate) || {
          dayNumber: session.dayNumber || sIdx + 1,
          formattedDate: sessDate || `Session ${sIdx + 1}`,
          isToday: false,
          dateStr: sessDate,
        };

        const isRun = session.type === 'run' || session.Workout_Type === 'Run';
        const daySteps = Number(stepsMap[dateMeta.dateStr] || 0);
        const isStepGoalMet = daySteps >= STEP_GOAL;

        let perfMetric = '';
        if (isRun) {
          const dist = session.distanceMiles || session.distance || 0;
          const pace = session.avgPace || '';
          const elev = session.elevationGainFt ? ` • ⛰️ +${Math.round(session.elevationGainFt)} ft` : '';
          perfMetric = `${dist} mi${pace ? ' • ' + pace : ''}${elev}`;
        } else {
          const vol = Number(session.totalVolumeLbs || session.Total_Volume_Lbs || 0);
          const sets = Number(
            session.totalSets ||
              session.Total_Sets ||
              (session.exercises ? session.exercises.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0) : 0)
          );
          if (vol > 0 || sets > 0) {
            perfMetric = `${vol.toLocaleString()} lbs total volume • ${sets} sets`;
          }
        }

        return {
          id: session.id || session.sessionId,
          sessionId: session.id || session.sessionId,
          dayNumber: dateMeta.dayNumber || sIdx + 1,
          dayName: dateMeta.formattedDate,
          title: session.workoutName || session.Workout_Name || (isRun ? 'Completed Run' : 'Lifting Session'),
          badgeLabel: isRun ? 'Run' : 'Strength',
          description: session.notes || 'Logged historical session',
          activityType: isRun ? 'run' : 'workout',
          status: 'Completed',
          perfMetric,
          targetExercises: session.exercises ? session.exercises.map((e) => e.exerciseName) : [],
          dateMeta,
          daySteps,
          isStepGoalMet,
          isWorkoutDone: true,
          isFullyComplete: true,
        };
      });
    }

    // No plan and no sessions for this week -> empty state
    return [];
  }, [rawWeekPlan, weekDates, weekDateSet, stepsMap, completedDayNumbers, isCurrentWeek, isPastWeek, weekSessions, perfMetricsMap, restHabitsMap]);

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
      refreshLoggedSessions();
      window.dispatchEvent(new CustomEvent('apexfit:run-logged', { detail: session }));
      setTimeout(() => {
        setRunLogToastMsg('');
      }, 4000);
    },
    [runLoggerDayItem, weeklyPlan, refreshLoggedSessions]
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
    currentMonday,
    isCurrentWeek,
    isPastWeek,
    isFutureWeek,
    hasDataForWeek: enhancedDays.length > 0,
    weekRangeDisplay,
    handlePrevWeek,
    handleNextWeek,
    handleJumpToCurrentWeek,
    selectedRunForDetails,
    handleOpenRunDetails,
    handleCloseRunDetails,
    handleOpenRunLogger,
    handleCloseRunLogger,
    handleRunLoggedSuccess,
    selectedWorkoutForReview,
    handleCloseWorkoutReview,
    handleSaveWorkoutReview,
  };
}
