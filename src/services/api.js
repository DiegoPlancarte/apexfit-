/**
 * Google Apps Script Web App API Service
 * Formats workout session and set data to match the Google Sheets (Sessions & Sets) schema
 * and dispatches POST requests to the deployed doPost(e) endpoint.
 */

import { getSessions, saveSession, queueSyncAction, runAllSyncs } from './db';
import { getLocalDateString, getLocalIsoString } from '../utils/date';

export { runAllSyncs };

export const STORAGE_KEY_API_URL = 'workout_tracker_gas_url';

export const DEFAULT_WEEKLY_PLAN = [
  {
    dayNumber: 1,
    dayName: 'Monday',
    title: 'Upper Body Hypertrophy',
    activityType: 'workout',
    badgeLabel: 'Upper Body Hypertrophy',
    description: 'Bench Press, Incline DB, Lat Pulldowns & Rows',
    targetExercises: ['Barbell Bench Press', 'Incline Dumbbell Press', 'Lat Pulldown'],
    status: 'Scheduled',
    perfMetric: '',
  },
  {
    dayNumber: 2,
    dayName: 'Tuesday',
    title: 'Lower Body Strength',
    activityType: 'workout',
    badgeLabel: 'Lower Body Power',
    description: 'Back Squats, RDLs, Walking Lunges & Calves',
    targetExercises: ['Barbell Back Squat', 'Romanian Deadlift'],
    status: 'Scheduled',
    perfMetric: '',
  },
  {
    dayNumber: 3,
    dayName: 'Wednesday',
    title: 'Zone 2 Recovery Run',
    activityType: 'run',
    badgeLabel: 'Distance Run',
    description: '5km steady pace run (aerobic base building)',
    status: 'Scheduled',
    perfMetric: '',
  },
  {
    dayNumber: 4,
    dayName: 'Thursday',
    title: 'Push Hypertrophy',
    activityType: 'workout',
    badgeLabel: 'Push Focus',
    description: 'Overhead Press, Incline Dumbbell & Lateral Raises',
    targetExercises: ['Overhead Shoulder Press', 'Incline Dumbbell Press', 'Lateral Raise'],
    status: 'Scheduled',
    perfMetric: '',
  },
  {
    dayNumber: 5,
    dayName: 'Friday',
    title: 'Pull & Back Hypertrophy',
    activityType: 'workout',
    badgeLabel: 'Pull Focus',
    description: 'Lat Pulldowns, Seated Cable Rows & Bicep Curls',
    targetExercises: ['Lat Pulldown', 'Seated Cable Row'],
    status: 'Scheduled',
    perfMetric: '',
  },
  {
    dayNumber: 6,
    dayName: 'Saturday',
    title: 'Interval Sprint Session',
    activityType: 'run',
    badgeLabel: 'Sprint Intervals',
    description: '10x 100m Hill Sprints / 30-min Intervals',
    status: 'Scheduled',
    perfMetric: '',
  },
  {
    dayNumber: 7,
    dayName: 'Sunday',
    title: 'Active Recovery & Mobility',
    activityType: 'rest',
    badgeLabel: 'Rest Day',
    description: 'Foam rolling, yoga stretching & 45-min easy walk',
    status: 'Scheduled',
    perfMetric: '',
  },
];

export const getApiUrl = () => {
  return (
    localStorage.getItem(STORAGE_KEY_API_URL) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GAS_WEB_APP_URL) ||
    ''
  );
};

export const setApiUrl = (url) => {
  if (!url) {
    localStorage.removeItem(STORAGE_KEY_API_URL);
  } else {
    localStorage.setItem(STORAGE_KEY_API_URL, url.trim());
  }
};

/**
 * Safely extracts active set duration in seconds across canonical and legacy aliases.
 *
 * @param {Object} set
 * @param {number|null} [fallback=0]
 * @returns {number|null}
 */
export const extractActiveSec = (set, fallback = 0) => {
  if (!set || typeof set !== 'object') return fallback;
  const raw =
    set.Active_Sec ??
    set.active_sec ??
    set.setActiveSec ??
    set.Set_Active_Sec ??
    set.tutSec ??
    set.tut;
  if (raw === null || raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Normalizes a single set record to ensure all schema fields are present and typed.
 */
export const normalizeSetRecord = (set = {}, fallbackExerciseName = '', index = 0) => {
  const activeSec = extractActiveSec(set, 0);
  return {
    exerciseName: String(set.exerciseName || fallbackExerciseName || '').trim(),
    setNumber: Number(set.setNumber ?? index + 1),
    weightLbs: Number(set.weightLbs ?? 0),
    reps: Number(set.reps ?? 0),
    rir: set.rir === '' || set.rir === null || set.rir === undefined ? null : Number(set.rir),
    setActiveSec: activeSec,
    active_sec: activeSec,
    Active_Sec: activeSec,
    Set_Active_Sec: activeSec,
    restAfterSec: Number(set.restAfterSec ?? 0),
    completed: Boolean(set.completed ?? true),
    completedAt: set.completedAt || getLocalIsoString(),
    activeStartedAt: set.activeStartedAt || null,
  };
};

/**
 * Builds the structured payload matching the Google Sheets `Sessions` and `Sets` tabs schema.
 *
 * @param {Object} workoutState - Current active workout state from App.jsx
 * @returns {Object} Formatted payload ready for GAS doPost
 */
export const buildWorkoutPayload = (workoutState) => {
  const nowIso = getLocalIsoString();
  const sessionId = workoutState.sessionId || `sess_${Date.now()}`;
  const startedAt = workoutState.startedAt || nowIso;
  const endedAt = workoutState.endedAt || nowIso;

  const durationSec =
    workoutState.durationSec ??
    Math.max(
      0,
      Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000)
    );

  // Support both flat `sets` array and grouped `exercises` array
  let rawSets = [];
  if (Array.isArray(workoutState.sets) && workoutState.sets.length > 0) {
    rawSets = workoutState.sets;
  } else if (Array.isArray(workoutState.exercises)) {
    workoutState.exercises.forEach((exercise) => {
      if (Array.isArray(exercise.sets)) {
        exercise.sets.forEach((set, idx) => {
          rawSets.push({
            ...set,
            exerciseName: set.exerciseName || exercise.name || exercise.exerciseName,
            setNumber: set.setNumber ?? idx + 1,
          });
        });
      }
    });
  }

  const completedSets = rawSets
    .filter((s) => s.completed !== false)
    .map((s, idx) => normalizeSetRecord(s, '', idx));

  const totalVolumeLbs = completedSets.reduce(
    (sum, s) => sum + (Number(s.weightLbs) || 0) * (Number(s.reps) || 0),
    0
  );

  const durationMin = Math.round((durationSec / 60) * 10) / 10;
  const sessionDate =
    workoutState.date ||
    workoutState.Date ||
    getLocalDateString(startedAt);
  const workoutType = workoutState.workoutType || workoutState.type || 'Strength';
  const workoutName = workoutState.workoutName || 'Workout Session';

  const groupedExercises = [];
  const exerciseMap = new Map();
  completedSets.forEach((s) => {
    const exName = s.exerciseName || 'Exercise';
    if (!exerciseMap.has(exName)) {
      exerciseMap.set(exName, []);
    }
    exerciseMap.get(exName).push(s);
  });
  exerciseMap.forEach((sets, exerciseName) => {
    groupedExercises.push({
      exerciseName,
      sets,
    });
  });

  const dayIndex =
    workoutState.planDayNumber ??
    workoutState.dayNumber ??
    workoutState.day_index ??
    null;

  const sessionRecord = {
    // Canonical Google Sheets (Sessions tab) snake_case headers
    Workout_ID: sessionId,
    Date: sessionDate,
    Workout_Type: workoutType,
    Workout_Name: workoutName,
    Total_Duration_Min: durationMin,
    Distance_Miles: Number(workoutState.distanceMiles || workoutState.distance || 0),
    Total_Sets: completedSets.length,
    Total_Volume_Lbs: totalVolumeLbs,
    Started_At: startedAt,
    Ended_At: endedAt,
    Notes: workoutState.notes || '',

    // Internal application aliases for backwards compatibility
    sessionId,
    id: sessionId,
    date: sessionDate,
    created_at: startedAt,
    type: workoutType,
    workoutName,
    durationSec,
    totalSets: completedSets.length,
    totalVolumeLbs,
    notes: workoutState.notes || '',
    planDayNumber: dayIndex,
    dayNumber: dayIndex,
    day_index: dayIndex,
    exercises: groupedExercises,
    sets: completedSets,
  };

  const setRecords = completedSets.map((s) => {
    const activeSec = extractActiveSec(s, 0);
    return {
      // Canonical Google Sheets (Sets tab) snake_case headers
      Workout_ID: sessionId,
      Date: sessionDate,
      Exercise: s.exerciseName,
      Set_Number: s.setNumber,
      Weight_Lbs: s.weightLbs,
      Reps: s.reps,
      RIR: s.rir,
      Active_Sec: activeSec,
      active_sec: activeSec,
      Set_Active_Sec: activeSec,
      setActiveSec: activeSec,
      Rest_After_Sec: s.restAfterSec,
      Completed_At: s.completedAt,

      // Internal application aliases for backwards compatibility
      sessionId,
      date: sessionDate,
      exerciseName: s.exerciseName,
      setNumber: s.setNumber,
      weightLbs: s.weightLbs,
      reps: s.reps,
      rir: s.rir,
      restAfterSec: s.restAfterSec,
      completedAt: s.completedAt,
      activeStartedAt: s.activeStartedAt || null,
    };
  });

  return {
    schemaVersion: '1.0',
    action: 'logWorkoutSession',
    timestamp: nowIso,
    session: sessionRecord,
    sets: setRecords,
  };
}

/**
 * Reconstructs grouped exercise records from a flat array of set records.
 *
 * @param {Array<Object>} sets
 * @returns {Array<{ exerciseName: string, sets: Array<Object> }>}
 */
export const groupSetsIntoExercises = (sets = []) => {
  if (!Array.isArray(sets) || sets.length === 0) return [];
  const exerciseMap = new Map();

  sets.forEach((s) => {
    const exName =
      s.exerciseName || s.Exercise || s.name || `Exercise ${exerciseMap.size + 1}`;
    if (!exerciseMap.has(exName)) {
      exerciseMap.set(exName, []);
    }
    exerciseMap.get(exName).push({
      setNumber: Number(s.setNumber ?? s.Set_Number ?? exerciseMap.get(exName).length + 1),
      weightLbs: Number(s.weightLbs ?? s.Weight_Lbs ?? s.weight ?? 0),
      reps: Number(s.reps ?? s.Reps ?? 0),
      rir:
        s.rir !== null && s.rir !== undefined && s.rir !== ''
          ? Number(s.rir)
          : s.RIR !== null && s.RIR !== undefined && s.RIR !== ''
          ? Number(s.RIR)
          : null,
      setActiveSec: extractActiveSec(s, null),
      active_sec: extractActiveSec(s, null),
      Active_Sec: extractActiveSec(s, null),
      Set_Active_Sec: extractActiveSec(s, null),
      restAfterSec: Number(s.restAfterSec ?? s.Rest_After_Sec ?? 0) || null,
      completed: s.completed !== false,
      completedAt: s.completedAt || s.Completed_At || getLocalIsoString(),
    });
  });

  return Array.from(exerciseMap.entries()).map(([exerciseName, setsList]) => ({
    exerciseName,
    sets: setsList,
  }));
};

/**
 * Normalizes a session record across storage formats (IndexedDB, Google Sheets, React state).
 * Guarantees that:
 * - exercises array is populated with valid set metrics (weight, reps, RIR).
 * - totalVolumeLbs and totalSets are computed if missing or zero.
 * - duration, date, day_index, and session identifiers are harmonized.
 *
 * @param {Object} session
 * @returns {Object} Normalized session object
 */
export const normalizeSessionRecord = (session) => {
  if (!session || typeof session !== 'object') return session;

  const sessionId =
    session.sessionId || session.Workout_ID || session.id || `sess_${Date.now()}`;
  const date =
    session.date ||
    session.Date ||
    (session.startedAt ? getLocalDateString(session.startedAt) : getLocalDateString());
  const workoutName =
    session.workoutName || session.Workout_Name || session.title || 'Workout Session';
  const type =
    session.type || session.Workout_Type || 'workout';
  const notes =
    session.notes || session.Notes || '';

  const durationSec =
    Number(session.durationSec ?? session.duration) ||
    (session.Total_Duration_Min != null ? Math.round(Number(session.Total_Duration_Min) * 60) : 0);
  const durationMin =
    session.Total_Duration_Min != null
      ? Number(session.Total_Duration_Min)
      : session.totalDurationMin != null
      ? Number(session.totalDurationMin)
      : Math.round((durationSec / 60) * 10) / 10;

  // Resolve exercises: from session.exercises or grouped from session.sets
  let exercises = [];
  if (Array.isArray(session.exercises) && session.exercises.length > 0) {
    exercises = session.exercises.map((ex) => ({
      exerciseName: ex.exerciseName || ex.name || ex.Exercise || 'Exercise',
      sets: Array.isArray(ex.sets)
        ? ex.sets.map((s, sIdx) => ({
            setNumber: Number(s.setNumber ?? s.Set_Number ?? sIdx + 1),
            weightLbs: Number(s.weightLbs ?? s.Weight_Lbs ?? s.weight ?? 0),
            reps: Number(s.reps ?? s.Reps ?? 0),
            rir:
              s.rir !== null && s.rir !== undefined && s.rir !== ''
                ? Number(s.rir)
                : s.RIR !== null && s.RIR !== undefined && s.RIR !== ''
                ? Number(s.RIR)
                : null,
            setActiveSec: extractActiveSec(s, null),
            active_sec: extractActiveSec(s, null),
            Active_Sec: extractActiveSec(s, null),
            Set_Active_Sec: extractActiveSec(s, null),
            restAfterSec: Number(s.restAfterSec ?? s.Rest_After_Sec ?? 0) || null,
            completed: s.completed !== false,
            completedAt: s.completedAt || s.Completed_At || getLocalIsoString(),
          }))
        : [],
    }));
  } else if (Array.isArray(session.sets) && session.sets.length > 0) {
    exercises = groupSetsIntoExercises(session.sets);
  } else if (Array.isArray(session.Sets) && session.Sets.length > 0) {
    exercises = groupSetsIntoExercises(session.Sets);
  }

  // Recalculate or fallback total volume and total sets
  const computedSetsCount = exercises.reduce((acc, ex) => acc + (ex.sets || []).length, 0);
  const computedVolume = exercises.reduce(
    (sum, ex) => sum + (ex.sets || []).reduce((sSum, s) => sSum + s.weightLbs * s.reps, 0),
    0
  );

  const totalSets =
    Number(session.totalSets ?? session.Total_Sets) || computedSetsCount;
  const totalVolumeLbs =
    Number(session.totalVolumeLbs ?? session.Total_Volume_Lbs) || computedVolume;

  let avgRir = session.avgRir ?? session.Avg_RIR ?? session.Avg_Rir ?? null;
  if (avgRir == null && computedSetsCount > 0) {
    let rirSum = 0;
    let rirCount = 0;
    exercises.forEach((ex) => {
      (ex.sets || []).forEach((s) => {
        if (s.rir !== null && s.rir !== undefined) {
          rirSum += Number(s.rir);
          rirCount += 1;
        }
      });
    });
    if (rirCount > 0) avgRir = Number((rirSum / rirCount).toFixed(1));
  }

  const dayIndex =
    session.day_index ?? session.dayIndex ?? session.dayNumber ?? session.planDayNumber ?? null;

  return {
    ...session,
    sessionId,
    id: sessionId,
    Workout_ID: sessionId,
    date,
    Date: date,
    created_at: session.created_at || session.startedAt || getLocalIsoString(),
    workoutName,
    Workout_Name: workoutName,
    type,
    Workout_Type: type,
    notes,
    Notes: notes,
    durationSec,
    Total_Duration_Min: durationMin,
    totalDurationMin: durationMin,
    totalSets,
    Total_Sets: totalSets,
    totalVolumeLbs,
    Total_Volume_Lbs: totalVolumeLbs,
    avgRir,
    day_index: dayIndex,
    dayNumber: dayIndex,
    planDayNumber: dayIndex,
    exercises,
  };
};

/**
 * Sends the formatted workout payload to the deployed Google Apps Script Web App.
 * Uses `text/plain;charset=utf-8` to prevent CORS preflight OPTIONS failure on GAS endpoints.
 *
 * @param {Object} workoutState - Active workout state or pre-built payload
 * @param {string} [overrideUrl] - Optional override for the GAS Web App URL
 * @returns {Promise<Object>} Response data from the GAS endpoint
 */
export const syncWorkoutToSheets = async (workoutState, overrideUrl) => {
  const endpointUrl = overrideUrl || getApiUrl();

  const payload =
    workoutState?.schemaVersion && workoutState?.session && Array.isArray(workoutState?.sets)
      ? workoutState
      : buildWorkoutPayload(workoutState);

  if (payload.sets.length === 0) {
    throw new Error('No completed sets to sync. Complete at least one set first.');
  }

  // Always persist session into local IndexedDB immediately
  await saveSession(payload.session).catch(() => {});

  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  if (!endpointUrl || isOffline) {
    await queueSyncAction('logWorkoutSession', payload).catch(() => {});
    return {
      status: 'queued_offline',
      payload,
      isOffline: true,
      message: 'Saved to local database. Workout queued for automatic sync when online.',
    };
  }

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        // text/plain avoids CORS preflight (OPTIONS) which Google Apps Script doPost does not support
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      await queueSyncAction('logWorkoutSession', payload).catch(() => {});
      return {
        status: 'queued_offline',
        payload,
        isOffline: true,
        message: `Sync queued in outbox (server returned HTTP ${response.status}).`,
      };
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return { status: 'ok', rawResponse: text, payload };
    }
  } catch (networkErr) {
    console.warn('Network error while syncing workout to Sheets, queuing in outbox:', networkErr);
    await queueSyncAction('logWorkoutSession', payload).catch(() => {});
    return {
      status: 'queued_offline',
      payload,
      isOffline: true,
      message: 'Network offline. Saved locally & queued in outbox for automatic sync.',
    };
  }
}

/**
 * Queries the `Plan` tab from the Google Apps Script Web App endpoint.
 * Returns the parsed array of weekly plan items or falls back to DEFAULT_WEEKLY_PLAN.
 *
 * @param {string} [overrideUrl]
 * @returns {Promise<Array>}
 */
export const fetchWeeklyPlan = async (overrideUrl) => {
  const endpointUrl = overrideUrl || getApiUrl();
  if (!endpointUrl) {
    return DEFAULT_WEEKLY_PLAN;
  }

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({ action: 'getWeeklyPlan' }),
    });

    if (!response.ok) {
      throw new Error(`GAS returned status ${response.status}`);
    }

    const text = await response.text();
    const data = JSON.parse(text);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.plan)) return data.plan;
    return DEFAULT_WEEKLY_PLAN;
  } catch (err) {
    console.warn('fetchWeeklyPlan falling back to local schedule:', err);
    return DEFAULT_WEEKLY_PLAN;
  }
}

/**
 * Updates a specific day's status in the Google Sheet `Plan` tab.
 *
 * @param {number|string} dayNumber
 * @param {string} status - 'Completed' | 'Scheduled'
 * @param {string} [overrideUrl]
 */
export const updatePlanDayStatus = async (dayNumber, status = 'Completed', overrideUrl) => {
  const endpointUrl = overrideUrl || getApiUrl();
  if (!endpointUrl) return null;

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'updatePlanStatus',
        dayNumber: Number(dayNumber),
        status,
        updatedAt: getLocalIsoString(),
      }),
    });

    if (!response.ok) return null;
    const text = await response.text();
    return JSON.parse(text);
  } catch (err) {
    console.warn('updatePlanDayStatus error:', err);
    return null;
  }
}

export const STORAGE_KEY_HISTORY_LOG = 'workout_tracker_historical_sessions_v1';

export const DEFAULT_HISTORICAL_SESSIONS = [];

/**
 * Queries the historical `Sessions` and `Sets` from the Google Apps Script Web App endpoint.
 * Returns reverse-chronological list of sessions, falling back to local cache or defaults.
 * Supports optional `startDate` and `endDate` query parameters for server-side & client-side filtering.
 *
 * @param {string|Object} [options] - overrideUrl string or { overrideUrl, startDate, endDate }
 * @returns {Promise<Array>}
 */
export const fetchHistoricalSessions = async (options) => {
  const opts = typeof options === 'string' ? { overrideUrl: options } : (options || {});
  const { overrideUrl, startDate, endDate } = opts;

  let localSessions = [];
  try {
    localSessions = await getSessions({ startDate, endDate });
  } catch (err) {
    console.warn('fetchHistoricalSessions IDB read error:', err);
  }

  if (!localSessions || localSessions.length === 0) {
    try {
      const cached = localStorage.getItem(STORAGE_KEY_HISTORY_LOG);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          localSessions = parsed;
        }
      }
    } catch {
      // fallback
    }
  }

  if (!localSessions || localSessions.length === 0) {
    localSessions = DEFAULT_HISTORICAL_SESSIONS;
  }

  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const endpointUrl = overrideUrl || getApiUrl();
  if (!endpointUrl || isOffline) {
    return filterSessionsByDate(localSessions, startDate, endDate);
  }

  try {
    const payload = {
      action: 'getHistoricalSessions',
      startDate: startDate || null,
      endDate: endDate || null,
    };

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) return filterSessionsByDate(localSessions, startDate, endDate);
    const text = await response.text();
    const data = JSON.parse(text);
    const remoteSessions = Array.isArray(data) ? data : data?.sessions;

    if (Array.isArray(remoteSessions) && remoteSessions.length > 0) {
      // Merge and persist remote records into local IndexedDB and localStorage
      for (const remoteSession of remoteSessions) {
        await saveSession(remoteSession).catch(() => {});
      }
      return filterSessionsByDate(remoteSessions, startDate, endDate);
    }
    return filterSessionsByDate(localSessions, startDate, endDate);
  } catch (err) {
    console.warn('fetchHistoricalSessions using local database:', err);
    return filterSessionsByDate(localSessions, startDate, endDate);
  }
}

const filterSessionsByDate = (sessionsList, startDate, endDate) => {
  if (!Array.isArray(sessionsList)) return [];
  if (!startDate && !endDate) return sessionsList;
  return sessionsList.filter((s) => {
    const sDate = s.date || (s.startedAt ? s.startedAt.split('T')[0] : '');
    if (!sDate) return true;
    if (startDate && sDate < startDate) return false;
    if (endDate && sDate > endDate) return false;
    return true;
  });
};

/**
 * Builds the structured payload for a manual run session matching the Google Sheets schema.
 *
 * @param {Object} runData - Form data from ManualRunLogger
 * @returns {Object} Formatted payload ready for GAS doPost with action 'logRunWorkout'
 */
export const buildRunPayload = (runData) => {
  const nowIso = getLocalIsoString();
  const sessionId = runData.sessionId || `run_${Date.now()}`;
  const startedAt = runData.startedAt || nowIso;
  const endedAt = runData.endedAt || nowIso;
  const durationSec = Number(runData.durationSec) || 0;
  const distanceMiles = Number(runData.distanceMiles) || 0;
  const distanceKm = Math.round(distanceMiles * 1.60934 * 100) / 100;

  const durationMin = Math.round((durationSec / 60) * 10) / 10;
  const runDate = runData.date || runData.Date || getLocalDateString(startedAt);
  const workoutTitle = runData.title?.trim() || runData.workoutName?.trim() || 'Running Session';

  const sessionRecord = {
    // Canonical Google Sheets (Sessions tab) snake_case headers
    Workout_ID: sessionId,
    Date: runDate,
    Workout_Type: 'Run',
    Workout_Name: workoutTitle,
    Total_Duration_Min: durationMin,
    Distance_Miles: distanceMiles,
    Distance_Km: distanceKm,
    Avg_Pace: runData.avgPace || '',
    Avg_Heart_Rate: runData.avgHeartRate ? Number(runData.avgHeartRate) : null,
    Terrain: runData.terrain || 'Road',
    Shoe_Name: runData.shoeName || '',
    Shoe_ID: runData.shoeId || '',
    Notes: runData.notes?.trim() || '',
    Highlight: runData.highlight || (distanceMiles ? `${distanceMiles} mi • ${runData.avgPace || ''}` : ''),
    Started_At: startedAt,
    Ended_At: endedAt,

    // Internal application aliases for backwards compatibility
    sessionId,
    date: runDate,
    type: 'run',
    workoutName: workoutTitle,
    durationSec,
    distanceMiles,
    distanceKm,
    avgPace: runData.avgPace || '',
    avgHeartRate: runData.avgHeartRate ? Number(runData.avgHeartRate) : null,
    terrain: runData.terrain || 'Road',
    shoeName: runData.shoeName || '',
    shoeId: runData.shoeId || '',
    notes: runData.notes?.trim() || '',
    highlight: runData.highlight || (distanceMiles ? `${distanceMiles} mi • ${runData.avgPace || ''}` : ''),
  };

  return {
    schemaVersion: '1.0',
    action: 'logRunWorkout',
    timestamp: nowIso,
    session: sessionRecord,
  };
}

/**
 * Saves a run session object into the local historical sessions log.
 */
export const saveRunToLocalHistory = (runSession) => {
  try {
    const cached = localStorage.getItem(STORAGE_KEY_HISTORY_LOG);
    const existing = cached ? JSON.parse(cached) : [];
    const updated = [runSession, ...existing.filter((s) => s.sessionId !== runSession.sessionId)];
    localStorage.setItem(STORAGE_KEY_HISTORY_LOG, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Failed to save run to local history:', err);
    return [];
  }
};

/**
 * Sends the formatted run workout payload to the deployed Google Apps Script Web App.
 *
 * @param {Object} runData - Data from ManualRunLogger
 * @param {string} [overrideUrl]
 * @returns {Promise<Object>}
 */
export const syncRunToSheets = async (runData, overrideUrl) => {
  const endpointUrl = overrideUrl || getApiUrl();
  const payload = runData?.schemaVersion ? runData : buildRunPayload(runData);

  // Always persist to local IndexedDB and localStorage logbook immediately
  saveRunToLocalHistory(payload.session);
  await saveSession(payload.session).catch(() => {});

  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  if (!endpointUrl || isOffline) {
    await queueSyncAction('logRunWorkout', payload).catch(() => {});
    return { status: 'queued_offline', session: payload.session, isOffline: true };
  }

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      await queueSyncAction('logRunWorkout', payload).catch(() => {});
      return { status: 'queued_offline', session: payload.session, isOffline: true };
    }

    const text = await response.text();
    try {
      const parsed = JSON.parse(text);
      return { ...parsed, session: payload.session };
    } catch {
      return { status: 'ok', rawResponse: text, session: payload.session };
    }
  } catch (networkErr) {
    console.warn('Network error syncing run, queuing in outbox:', networkErr);
    await queueSyncAction('logRunWorkout', payload).catch(() => {});
    return { status: 'queued_offline', session: payload.session, isOffline: true };
  }
}
