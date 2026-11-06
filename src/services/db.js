/**
 * IndexedDB Local Database & Mirror Schema Service (ApexFitDB)
 *
 * Provides a robust offline-first persistence layer mirroring Google Sheets tabs:
 * - `sessions`: Completed lifting workouts and running sessions with exercise/set breakdowns.
 * - `body_metrics`: Weight check-ins, body fat %, and physical wellness logs.
 * - `shoe_rotation`: Running shoe fleet with mileage odometers and retirement thresholds.
 * - `sync_outbox`: Offline mutation action queue for automatic background synchronization.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  DEFAULT_HISTORICAL_SESSIONS,
  STORAGE_KEY_HISTORY_LOG,
  getApiUrl,
  normalizeSessionRecord,
  extractActiveSec,
} from './api';
import {
  DEFAULT_SHOES,
  STORAGE_KEY_SHOES,
  LEGACY_STORAGE_KEY_SHOES,
} from './runningService';
import { getLocalDateString, getLocalIsoString } from '../utils/date';

export const DB_NAME = 'ApexFitDB';
export const LEGACY_DB_NAME = 'IronLogDB';
export const DB_VERSION = 1;

export const STORAGE_KEY_OVERLOAD_HISTORY = 'apexfit_overload_history';
export const LEGACY_STORAGE_KEY_OVERLOAD_HISTORY = 'ironlog_overload_history';

export const STORES = {
  SESSIONS: 'sessions',
  BODY_METRICS: 'body_metrics',
  SHOE_ROTATION: 'shoe_rotation',
  SYNC_OUTBOX: 'sync_outbox',
};

export const DEFAULT_BODY_METRICS = [
  {
    id: 'metric_1',
    date: '2026-11-02',
    weightLbs: 178.4,
    bodyFatPct: 14.8,
    notes: 'Morning weigh-in, fasted',
    recordedAt: '2026-11-02T07:15:00.000Z',
  },
  {
    id: 'metric_2',
    date: '2026-10-26',
    weightLbs: 179.2,
    bodyFatPct: 15.0,
    notes: 'Post-weekend check-in',
    recordedAt: '2026-10-26T07:30:00.000Z',
  },
  {
    id: 'metric_3',
    date: '2026-10-19',
    weightLbs: 180.1,
    bodyFatPct: 15.2,
    notes: 'Starting training cycle weigh-in',
    recordedAt: '2026-10-19T07:20:00.000Z',
  },
];

let dbPromise = null;

const countRecords = (db, storeName) =>
  new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    } catch {
      resolve(0);
    }
  });

const putBatch = (db, storeName, items) =>
  new Promise((resolve, reject) => {
    if (!Array.isArray(items) || items.length === 0) return resolve();
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      items.forEach((item) => store.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });

/**
 * Seeds initial store contents from localStorage or defaults if empty.
 */
const seedInitialData = async (db) => {
  try {
    // 1. Seed Sessions
    const sessionCount = await countRecords(db, STORES.SESSIONS);
    if (sessionCount === 0) {
      let initialSessions = DEFAULT_HISTORICAL_SESSIONS;
      try {
        const cached = localStorage.getItem(STORAGE_KEY_HISTORY_LOG);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) initialSessions = parsed;
        }
      } catch {
        // fallback to defaults
      }
      await putBatch(db, STORES.SESSIONS, initialSessions);
    }

    // 2. Seed Shoe Rotation
    const shoeCount = await countRecords(db, STORES.SHOE_ROTATION);
    if (shoeCount === 0) {
      let initialShoes = DEFAULT_SHOES;
      try {
        const cached =
          localStorage.getItem(STORAGE_KEY_SHOES) ||
          localStorage.getItem(LEGACY_STORAGE_KEY_SHOES);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) initialShoes = parsed;
        }
      } catch {
        // fallback to defaults
      }
      await putBatch(db, STORES.SHOE_ROTATION, initialShoes);
    }

    // 3. Seed Body Metrics
    const metricsCount = await countRecords(db, STORES.BODY_METRICS);
    if (metricsCount === 0) {
      await putBatch(db, STORES.BODY_METRICS, DEFAULT_BODY_METRICS);
    }
  } catch (err) {
    console.warn('seedInitialData encountered an error:', err);
  }
};

/**
 * Initializes and returns the singleton connection to ApexFitDB.
 * Handles schema migrations and initial store creation.
 *
 * @returns {Promise<IDBDatabase>}
 */
export const openDB = () => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Sessions Store (keyPath: sessionId)
      if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
        const sessionStore = db.createObjectStore(STORES.SESSIONS, {
          keyPath: 'sessionId',
        });
        sessionStore.createIndex('date', 'date', { unique: false });
        sessionStore.createIndex('type', 'type', { unique: false });
        sessionStore.createIndex('startedAt', 'startedAt', { unique: false });
      }

      // 2. Body Metrics Store (keyPath: id)
      if (!db.objectStoreNames.contains(STORES.BODY_METRICS)) {
        const metricsStore = db.createObjectStore(STORES.BODY_METRICS, {
          keyPath: 'id',
        });
        metricsStore.createIndex('date', 'date', { unique: false });
      }

      // 3. Shoe Rotation Store (keyPath: id)
      if (!db.objectStoreNames.contains(STORES.SHOE_ROTATION)) {
        const shoeStore = db.createObjectStore(STORES.SHOE_ROTATION, {
          keyPath: 'id',
        });
        shoeStore.createIndex('isActive', 'isActive', { unique: false });
      }

      // 4. Sync Outbox Store (keyPath: id, autoIncrement)
      if (!db.objectStoreNames.contains(STORES.SYNC_OUTBOX)) {
        const outboxStore = db.createObjectStore(STORES.SYNC_OUTBOX, {
          keyPath: 'id',
          autoIncrement: true,
        });
        outboxStore.createIndex('synced', 'synced', { unique: false });
        outboxStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;

      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };

      // Seed initial data asynchronously if stores are currently empty
      seedInitialData(db).catch((err) => {
        console.warn('Initial seed non-blocking warning:', err);
      });

      resolve(db);
    };

    request.onerror = (event) => {
      dbPromise = null;
      reject(event.target.error || new Error('Failed to open IndexedDB.'));
    };
  });

  return dbPromise;
};

/**
 * Ensures that the IndexedDB database is open and seeded with initial baseline records
 * if empty, preventing any blank or broken screens on first launch.
 *
 * @returns {Promise<IDBDatabase>}
 */
export const ensureDatabaseSeeded = async () => {
  const db = await openDB();
  await seedInitialData(db);
  return db;
};

/* ==========================================================================
   REPOSITORY WRAPPERS: SESSIONS
   ========================================================================== */

/**
 * Retrieves all workout and running sessions from IndexedDB.
 * Supports optional date range filtering and always returns records sorted
 * reverse-chronologically (newest session first).
 *
 * @param {Object} [options]
 * @param {string} [options.startDate] - 'YYYY-MM-DD'
 * @param {string} [options.endDate]   - 'YYYY-MM-DD'
 * @returns {Promise<Array<Object>>}
 */
export const getSessions = async (options = {}) => {
  const { startDate, endDate } = options;

  try {
    const db = await openDB();
    const records = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SESSIONS, 'readonly');
      const store = tx.objectStore(STORES.SESSIONS);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    // Sort newest session first and normalize records
    const sorted = records.map(normalizeSessionRecord).sort((a, b) => {
      const timeA = new Date(a.date || a.startedAt || 0).getTime();
      const timeB = new Date(b.date || b.startedAt || 0).getTime();
      return timeB - timeA;
    });

    if (!startDate && !endDate) return sorted;

    return sorted.filter((s) => {
      const sDate = s.date || (s.startedAt ? s.startedAt.split('T')[0] : '');
      if (!sDate) return true;
      if (startDate && sDate < startDate) return false;
      if (endDate && sDate > endDate) return false;
      return true;
    });
  } catch (err) {
    console.warn('getSessions falling back to localStorage:', err);
    // Fallback to localStorage for resilient continuity
    try {
      const cached = localStorage.getItem(STORAGE_KEY_HISTORY_LOG);
      const list = cached ? JSON.parse(cached) : DEFAULT_HISTORICAL_SESSIONS;
      return (Array.isArray(list) ? list : []).map(normalizeSessionRecord);
    } catch {
      return (DEFAULT_HISTORICAL_SESSIONS || []).map(normalizeSessionRecord);
    }
  }
};

/**
 * Computes progressive overload reference history from a list of completed sessions.
 * Extracts the most recent sets for each exercise name from real logged sessions.
 *
 * @param {Array<Object>} sessions
 * @returns {Record<string, Array<{ setNumber: number, weightLbs: number, reps: number, rir?: number }>>}
 */
export const extractProgressiveOverloadHistory = (sessions) => {
  if (!Array.isArray(sessions)) return {};
  const historyMap = {};

  // Sort newest first
  const sorted = [...sessions].sort((a, b) => {
    const timeA = new Date(a.date || a.startedAt || 0).getTime();
    const timeB = new Date(b.date || b.startedAt || 0).getTime();
    return timeB - timeA;
  });

  sorted.forEach((session) => {
    if (Array.isArray(session.exercises)) {
      session.exercises.forEach((ex) => {
        const name = ex.exerciseName || ex.name;
        if (!name || historyMap[name]) return;
        const completedSets = (ex.sets || []).filter((s) => s.completed !== false);
        if (completedSets.length > 0) {
          historyMap[name] = completedSets.map((s, idx) => ({
            setNumber: idx + 1,
            weightLbs: Number(s.weightLbs || 0),
            reps: Number(s.reps || 0),
            rir: s.rir ?? 2,
          }));
        }
      });
    }
  });

  return historyMap;
};

/**
 * Retrieves a single session by its sessionId.
 *
 * @param {string} sessionId
 * @returns {Promise<Object|null>}
 */
export const getSessionById = async (sessionId) => {
  if (!sessionId) return null;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SESSIONS, 'readonly');
      const store = tx.objectStore(STORES.SESSIONS);
      const req = store.get(sessionId);
      req.onsuccess = () => resolve(req.result ? normalizeSessionRecord(req.result) : null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
};

/**
 * Saves or updates a session in the local IndexedDB database and synchronizes localStorage.
 *
 * @param {Object} session
 * @returns {Promise<Object>}
 */
export const saveSession = async (session) => {
  if (!session) throw new Error('Cannot save an empty session record.');

  const localDate = session.date || session.Date || getLocalDateString();
  const sessionRecord = {
    ...session,
    sessionId: session.sessionId || session.Workout_ID || `sess_${Date.now()}`,
    date: localDate,
    Date: localDate,
    created_at: session.created_at || session.startedAt || getLocalIsoString(),
    updatedAt: getLocalIsoString(),
  };

  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SESSIONS, 'readwrite');
      const store = tx.objectStore(STORES.SESSIONS);
      const req = store.put(sessionRecord);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('saveSession IndexedDB put error, keeping localStorage in sync:', err);
  }

  // Keep localStorage historical log mirror updated
  try {
    const cached = localStorage.getItem(STORAGE_KEY_HISTORY_LOG);
    const existing = cached ? JSON.parse(cached) : [...DEFAULT_HISTORICAL_SESSIONS];
    const updated = [
      sessionRecord,
      ...existing.filter((s) => s.sessionId !== sessionRecord.sessionId),
    ];
    localStorage.setItem(STORAGE_KEY_HISTORY_LOG, JSON.stringify(updated));
  } catch {
    // ignore
  }

  return sessionRecord;
};

/**
 * Deletes a session by sessionId from IndexedDB and localStorage.
 *
 * @param {string} sessionId
 * @returns {Promise<boolean>}
 */
export const deleteSession = async (sessionId) => {
  if (!sessionId) return false;

  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SESSIONS, 'readwrite');
      const store = tx.objectStore(STORES.SESSIONS);
      const req = store.delete(sessionId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('deleteSession IndexedDB error:', err);
  }

  try {
    const cached = localStorage.getItem(STORAGE_KEY_HISTORY_LOG);
    if (cached) {
      const existing = JSON.parse(cached);
      const updated = existing.filter((s) => s.sessionId !== sessionId);
      localStorage.setItem(STORAGE_KEY_HISTORY_LOG, JSON.stringify(updated));
    }
  } catch {
    // ignore
  }

  return true;
};

/* ==========================================================================
   REPOSITORY WRAPPERS: BODY METRICS
   ========================================================================== */

/**
 * Retrieves all body composition records, sorted newest first.
 *
 * @returns {Promise<Array<Object>>}
 */
export const getBodyMetrics = async () => {
  try {
    const db = await openDB();
    const records = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.BODY_METRICS, 'readonly');
      const store = tx.objectStore(STORES.BODY_METRICS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    if (records.length === 0) return DEFAULT_BODY_METRICS;

    return records.sort((a, b) => {
      const dateA = new Date(a.date || a.recordedAt || 0).getTime();
      const dateB = new Date(b.date || b.recordedAt || 0).getTime();
      return dateB - dateA;
    });
  } catch {
    return DEFAULT_BODY_METRICS;
  }
};

/**
 * Saves a body metric entry into IndexedDB.
 *
 * @param {Object} metric
 * @returns {Promise<Object>}
 */
export const saveBodyMetric = async (metric) => {
  const localDate = metric.date || metric.Date || getLocalDateString();
  const record = {
    ...metric,
    id: metric.id || `metric_${Date.now()}`,
    date: localDate,
    Date: localDate,
    recordedAt: metric.recordedAt || getLocalIsoString(),
  };

  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.BODY_METRICS, 'readwrite');
    const store = tx.objectStore(STORES.BODY_METRICS);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  return record;
};

/* ==========================================================================
   REPOSITORY WRAPPERS: SHOE ROTATION
   ========================================================================== */

/**
 * Retrieves the shoe fleet from IndexedDB.
 *
 * @returns {Promise<Array<Object>>}
 */
export const getShoeRotation = async () => {
  try {
    const db = await openDB();
    const records = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SHOE_ROTATION, 'readonly');
      const store = tx.objectStore(STORES.SHOE_ROTATION);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    if (records.length === 0) return DEFAULT_SHOES;
    return records;
  } catch {
    return DEFAULT_SHOES;
  }
};

/**
 * Saves a single shoe record to IndexedDB and synchronizes localStorage.
 *
 * @param {Object} shoe
 * @returns {Promise<Object>}
 */
export const saveShoe = async (shoe) => {
  if (!shoe || !shoe.id) throw new Error('Invalid shoe record: must have an id.');

  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SHOE_ROTATION, 'readwrite');
      const store = tx.objectStore(STORES.SHOE_ROTATION);
      const req = store.put(shoe);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('saveShoe IndexedDB error:', err);
  }

  return shoe;
};

/**
 * Replaces the entire shoe rotation in IndexedDB with an updated array.
 *
 * @param {Array<Object>} shoes
 * @returns {Promise<Array<Object>>}
 */
export const saveAllShoes = async (shoes) => {
  if (!Array.isArray(shoes)) return [];

  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SHOE_ROTATION, 'readwrite');
      const store = tx.objectStore(STORES.SHOE_ROTATION);
      store.clear();
      shoes.forEach((s) => store.put(s));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('saveAllShoes IndexedDB error:', err);
  }

  return shoes;
};

/* ==========================================================================
   REPOSITORY WRAPPERS: SYNC OUTBOX (OFFLINE QUEUE)
   ========================================================================== */

/**
 * Normalizes an outbox action payload to match the exact snake_case Google Sheets column schema:
 * - Sessions tab: Workout_ID, Date, Workout_Type, Total_Duration_Min, Distance_Miles, etc.
 * - Sets tab: Workout_ID, Date, Exercise, Set_Number, Weight_Lbs, Reps, RIR, etc.
 * - Body_Metrics tab: Metric_ID, Date, Weight_Lbs, Body_Fat_Pct, Notes, etc.
 * - Shoe_Rotation tab: Shoe_ID, Shoe_Name, Brand, Current_Miles, Max_Miles, Is_Active, Terrain, etc.
 *
 * @param {string} action
 * @param {Object} rawPayload
 * @returns {Object} Normalized payload with canonical Google Sheets column keys
 */
export const normalizeOutboxPayload = (action, rawPayload) => {
  if (!rawPayload || typeof rawPayload !== 'object') return rawPayload;

  const todayDate = getLocalDateString();
  const nowIso = getLocalIsoString();

  if (action === 'logWorkoutSession' || (!action && rawPayload.action === 'logWorkoutSession')) {
    const rawSession = rawPayload.session || rawPayload;
    const sessionId =
      rawSession.Workout_ID ||
      rawSession.sessionId ||
      rawPayload.sessionId ||
      `sess_${Date.now()}`;
    const date =
      rawSession.Date ||
      rawSession.date ||
      rawPayload.date ||
      (rawSession.startedAt ? getLocalDateString(rawSession.startedAt) : todayDate);
    const workoutType =
      rawSession.Workout_Type ||
      rawSession.type ||
      rawSession.workoutType ||
      'Strength';
    const durationSec = Number(rawSession.durationSec ?? rawSession.duration ?? 0);
    const durationMin =
      rawSession.Total_Duration_Min != null
        ? Number(rawSession.Total_Duration_Min)
        : rawSession.totalDurationMin != null
        ? Number(rawSession.totalDurationMin)
        : Math.round((durationSec / 60) * 10) / 10;
    const distanceMiles = Number(
      rawSession.Distance_Miles ?? rawSession.distanceMiles ?? rawSession.distance ?? 0
    );

    const rawSets =
      Array.isArray(rawPayload.sets) && rawPayload.sets.length > 0
        ? rawPayload.sets
        : Array.isArray(rawSession.sets) && rawSession.sets.length > 0
        ? rawSession.sets
        : Array.isArray(rawSession.exercises)
        ? rawSession.exercises.flatMap((ex) =>
            (ex.sets || []).map((s, idx) => ({
              ...s,
              exerciseName: s.exerciseName || ex.exerciseName || ex.name,
              setNumber: s.setNumber ?? idx + 1,
            }))
          )
        : [];

    const normalizedSets = rawSets.map((s, idx) => {
      const activeDuration = extractActiveSec(s, 0);
      return {
        // Canonical Google Sheets Sets tab column headers
        Workout_ID: s.Workout_ID || s.sessionId || sessionId,
        Date: s.Date || s.date || date,
        Exercise: s.Exercise || s.exerciseName || s.name || `Exercise ${idx + 1}`,
        Set_Number: Number(s.Set_Number ?? s.setNumber ?? idx + 1),
        Weight_Lbs: Number(s.Weight_Lbs ?? s.weightLbs ?? 0),
        Reps: Number(s.Reps ?? s.reps ?? 0),
        RIR: Number(s.RIR ?? s.rir ?? 0),
        Active_Sec: activeDuration,
        active_sec: activeDuration,
        Set_Active_Sec: activeDuration,
        Rest_After_Sec: Number(s.Rest_After_Sec ?? s.restAfterSec ?? 0),
        Completed_At: s.Completed_At || s.completedAt || nowIso,

        // App compatibility fallbacks
        sessionId: s.Workout_ID || s.sessionId || sessionId,
        date: s.Date || s.date || date,
        exerciseName: s.Exercise || s.exerciseName || s.name || `Exercise ${idx + 1}`,
        setNumber: Number(s.Set_Number ?? s.setNumber ?? idx + 1),
        weightLbs: Number(s.Weight_Lbs ?? s.weightLbs ?? 0),
        reps: Number(s.Reps ?? s.reps ?? 0),
        rir: Number(s.RIR ?? s.rir ?? 0),
        setActiveSec: activeDuration,
        restAfterSec: Number(s.Rest_After_Sec ?? s.restAfterSec ?? 0),
        completedAt: s.Completed_At || s.completedAt || nowIso,
      };
    });

    const totalVolumeLbs =
      rawSession.Total_Volume_Lbs ??
      rawSession.totalVolumeLbs ??
      normalizedSets.reduce((sum, s) => sum + s.Weight_Lbs * s.Reps, 0);

    const normalizedSession = {
      // Canonical Google Sheets Sessions tab column headers
      Workout_ID: sessionId,
      Date: date,
      Workout_Type: workoutType,
      Workout_Name: rawSession.Workout_Name || rawSession.workoutName || 'Workout Session',
      Total_Duration_Min: durationMin,
      Distance_Miles: distanceMiles,
      Total_Sets: normalizedSets.length,
      Total_Volume_Lbs: totalVolumeLbs,
      Started_At: rawSession.Started_At || rawSession.startedAt || nowIso,
      Ended_At: rawSession.Ended_At || rawSession.endedAt || nowIso,
      Notes: rawSession.Notes || rawSession.notes || '',

      // App compatibility fallbacks
      sessionId,
      id: sessionId,
      date,
      created_at: rawSession.created_at || rawSession.startedAt || nowIso,
      type: workoutType,
      workoutName: rawSession.Workout_Name || rawSession.workoutName || 'Workout Session',
      durationSec,
      totalSets: normalizedSets.length,
      totalVolumeLbs,
      notes: rawSession.Notes || rawSession.notes || '',
    };

    return {
      schemaVersion: rawPayload.schemaVersion || '1.0',
      action: 'logWorkoutSession',
      timestamp: rawPayload.timestamp || nowIso,
      session: normalizedSession,
      sets: normalizedSets,
    };
  }

  if (action === 'logRunWorkout' || (!action && rawPayload.action === 'logRunWorkout')) {
    const rawSession = rawPayload.session || rawPayload;
    const sessionId =
      rawSession.Workout_ID ||
      rawSession.sessionId ||
      rawPayload.sessionId ||
      `run_${Date.now()}`;
    const date =
      rawSession.Date ||
      rawSession.date ||
      rawPayload.date ||
      (rawSession.startedAt ? getLocalDateString(rawSession.startedAt) : todayDate);
    const durationSec = Number(rawSession.durationSec ?? rawSession.duration ?? 0);
    const durationMin =
      rawSession.Total_Duration_Min != null
        ? Number(rawSession.Total_Duration_Min)
        : rawSession.totalDurationMin != null
        ? Number(rawSession.totalDurationMin)
        : Math.round((durationSec / 60) * 10) / 10;
    const distanceMiles = Number(
      rawSession.Distance_Miles ?? rawSession.distanceMiles ?? rawSession.distance ?? 0
    );
    const distanceKm =
      rawSession.Distance_Km ??
      rawSession.distanceKm ??
      Math.round(distanceMiles * 1.60934 * 100) / 100;

    const workoutName =
      rawSession.Workout_Name ||
      rawSession.workoutName ||
      rawSession.title ||
      'Running Session';

    const normalizedSession = {
      // Canonical Google Sheets Sessions tab column headers
      Workout_ID: sessionId,
      Date: date,
      Workout_Type: 'Run',
      Workout_Name: workoutName,
      Total_Duration_Min: durationMin,
      Distance_Miles: distanceMiles,
      Distance_Km: distanceKm,
      Avg_Pace: rawSession.Avg_Pace || rawSession.avgPace || '',
      Avg_Heart_Rate:
        rawSession.Avg_Heart_Rate != null
          ? Number(rawSession.Avg_Heart_Rate)
          : rawSession.avgHeartRate != null
          ? Number(rawSession.avgHeartRate)
          : null,
      Terrain: rawSession.Terrain || rawSession.terrain || 'Road',
      Shoe_Name: rawSession.Shoe_Name || rawSession.shoeName || '',
      Shoe_ID: rawSession.Shoe_ID || rawSession.shoeId || '',
      Notes: rawSession.Notes || rawSession.notes || '',
      Highlight:
        rawSession.Highlight ||
        rawSession.highlight ||
        (distanceMiles ? `${distanceMiles} mi • ${rawSession.avgPace || ''}` : ''),
      Started_At: rawSession.Started_At || rawSession.startedAt || nowIso,
      Ended_At: rawSession.Ended_At || rawSession.endedAt || nowIso,

      // App compatibility fallbacks
      sessionId,
      date,
      type: 'run',
      workoutName,
      durationSec,
      distanceMiles,
      distanceKm,
      avgPace: rawSession.Avg_Pace || rawSession.avgPace || '',
      avgHeartRate:
        rawSession.Avg_Heart_Rate != null
          ? Number(rawSession.Avg_Heart_Rate)
          : rawSession.avgHeartRate != null
          ? Number(rawSession.avgHeartRate)
          : null,
      terrain: rawSession.Terrain || rawSession.terrain || 'Road',
      shoeName: rawSession.Shoe_Name || rawSession.shoeName || '',
      shoeId: rawSession.Shoe_ID || rawSession.shoeId || '',
      notes: rawSession.Notes || rawSession.notes || '',
      highlight:
        rawSession.Highlight ||
        rawSession.highlight ||
        (distanceMiles ? `${distanceMiles} mi • ${rawSession.avgPace || ''}` : ''),
    };

    return {
      schemaVersion: rawPayload.schemaVersion || '1.0',
      action: 'logRunWorkout',
      timestamp: rawPayload.timestamp || nowIso,
      session: normalizedSession,
    };
  }

  if (action === 'updateShoeFleet' || (!action && rawPayload.action === 'updateShoeFleet')) {
    const shoe = rawPayload.shoe;
    if (shoe) {
      const normalizedShoe = {
        Shoe_ID: shoe.Shoe_ID || shoe.id,
        Shoe_Name: shoe.Shoe_Name || shoe.name,
        Brand: shoe.Brand || shoe.brand || '',
        Current_Miles: Number(shoe.Current_Miles ?? shoe.currentMiles ?? 0),
        Max_Miles: Number(shoe.Max_Miles ?? shoe.maxMiles ?? 350),
        Is_Active: Boolean(shoe.Is_Active ?? shoe.isActive),
        Terrain: shoe.Terrain || shoe.terrain || 'Road',
        Purchased_Date: shoe.Purchased_Date || shoe.purchasedDate || todayDate,
        id: shoe.Shoe_ID || shoe.id,
        name: shoe.Shoe_Name || shoe.name,
        currentMiles: Number(shoe.Current_Miles ?? shoe.currentMiles ?? 0),
        maxMiles: Number(shoe.Max_Miles ?? shoe.maxMiles ?? 350),
        isActive: Boolean(shoe.Is_Active ?? shoe.isActive),
        terrain: shoe.Terrain || shoe.terrain || 'Road',
      };
      return {
        ...rawPayload,
        action: 'updateShoeFleet',
        shoe: normalizedShoe,
      };
    }
  }

  if (action === 'logBodyMetric' || (!action && rawPayload.action === 'logBodyMetric')) {
    const metric = rawPayload.metric || rawPayload;
    const normalizedMetric = {
      Metric_ID: metric.Metric_ID || metric.id || `metric_${Date.now()}`,
      Date: metric.Date || metric.date || todayDate,
      Weight_Lbs: Number(metric.Weight_Lbs ?? metric.weightLbs ?? 0),
      Body_Fat_Pct:
        metric.Body_Fat_Pct != null
          ? Number(metric.Body_Fat_Pct)
          : metric.bodyFatPct != null
          ? Number(metric.bodyFatPct)
          : null,
      Notes: metric.Notes || metric.notes || '',
      id: metric.Metric_ID || metric.id || `metric_${Date.now()}`,
      date: metric.Date || metric.date || todayDate,
      weightLbs: Number(metric.Weight_Lbs ?? metric.weightLbs ?? 0),
      bodyFatPct:
        metric.Body_Fat_Pct != null
          ? Number(metric.Body_Fat_Pct)
          : metric.bodyFatPct != null
          ? Number(metric.bodyFatPct)
          : null,
      notes: metric.Notes || metric.notes || '',
    };
    return {
      schemaVersion: rawPayload.schemaVersion || '1.0',
      action: 'logBodyMetric',
      timestamp: rawPayload.timestamp || nowIso,
      metric: normalizedMetric,
    };
  }

  return rawPayload;
}

/**
 * Queues an action for background synchronization when connectivity is restored.
 *
 * @param {string|Object} actionOrObj - Action name (e.g., 'logWorkoutSession') or { action, payload }
 * @param {Object} [payload] - Action payload
 * @returns {Promise<number>} Auto-incremented Outbox entry ID
 */
export const queueSyncAction = async (actionOrObj, payload) => {
  const action = typeof actionOrObj === 'string' ? actionOrObj : actionOrObj.action;
  const data = typeof actionOrObj === 'string' ? payload : actionOrObj.payload;

  const normalizedPayload = normalizeOutboxPayload(action, data);

  const entry = {
    action,
    payload: normalizedPayload,
    timestamp: getLocalIsoString(),
    synced: false,
    attempts: 0,
  };

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYNC_OUTBOX, 'readwrite');
    const store = tx.objectStore(STORES.SYNC_OUTBOX);
    const req = store.add(entry);

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

/**
 * Returns all un-synced actions currently stored in the outbox.
 *
 * @returns {Promise<Array<Object>>}
 */
export const getPendingSyncActions = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SYNC_OUTBOX, 'readonly');
      const store = tx.objectStore(STORES.SYNC_OUTBOX);
      const req = store.getAll();

      req.onsuccess = () => {
        const all = req.result || [];
        resolve(all.filter((item) => item.synced === false));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
};

/**
 * Marks an outbox item as completed or deletes it after successful transmission.
 *
 * @param {number} id
 * @param {boolean} [deleteCompleted=true]
 * @returns {Promise<void>}
 */
export const markSyncActionDone = async (id, deleteCompleted = true) => {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SYNC_OUTBOX, 'readwrite');
      const store = tx.objectStore(STORES.SYNC_OUTBOX);

      if (deleteCompleted) {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } else {
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          const item = getReq.result;
          if (item) {
            item.synced = true;
            item.syncedAt = getLocalIsoString();
            store.put(item);
          }
          resolve();
        };
        getReq.onerror = () => reject(getReq.error);
      }
    });
  } catch (err) {
    console.warn('markSyncActionDone error:', err);
  }
};

/**
 * Clears all items in the sync outbox.
 */
export const clearSyncOutbox = async () => {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SYNC_OUTBOX, 'readwrite');
      const store = tx.objectStore(STORES.SYNC_OUTBOX);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('clearSyncOutbox error:', err);
  }
};

/* ==========================================================================
   BACKUP & RESTORE UTILITIES (DATA EXPORT / IMPORT)
   ========================================================================== */

/**
 * Packages all local IndexedDB stores (sessions, shoe_rotation, body_metrics)
 * into a structured, timestamped JSON object.
 *
 * @returns {Promise<Object>}
 */
export const exportBackupData = async () => {
  const [sessions, shoeRotation, bodyMetrics] = await Promise.all([
    getSessions(),
    getShoeRotation(),
    getBodyMetrics(),
  ]);

  return {
    app: 'apexfit-pwa',
    version: '1.0',
    exportedAt: getLocalIsoString(),
    stores: {
      sessions,
      shoe_rotation: shoeRotation,
      body_metrics: bodyMetrics,
    },
  };
};

/**
 * Triggers a browser download of the packaged backup JSON file.
 */
export const downloadBackupFile = async () => {
  const backup = await exportBackupData();
  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const dateStr = getLocalDateString();
  const a = document.createElement('a');
  a.href = url;
  a.download = `apexfit-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return backup;
};

/**
 * Safely parses and upserts records from a backup JSON object into IndexedDB.
 *
 * @param {Object|string} backupData
 * @returns {Promise<{ success: boolean, imported: { sessions: number, shoes: number, metrics: number } }>}
 */
export const importBackupData = async (backupData) => {
  let parsed = backupData;
  if (typeof backupData === 'string') {
    parsed = JSON.parse(backupData);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid backup file: content is not a valid JSON object.');
  }

  const stores = parsed.stores || parsed;
  let sessionsCount = 0;
  let shoesCount = 0;
  let metricsCount = 0;

  // 1. Upsert Sessions
  if (Array.isArray(stores.sessions)) {
    for (const session of stores.sessions) {
      if (session && session.sessionId) {
        await saveSession(session);
        sessionsCount += 1;
      }
    }
  }

  // 2. Upsert Shoe Rotation
  if (Array.isArray(stores.shoe_rotation)) {
    const validShoes = stores.shoe_rotation.filter((s) => s && s.id);
    if (validShoes.length > 0) {
      await saveAllShoes(validShoes);
      shoesCount = validShoes.length;
    }
  }

  // 3. Upsert Body Metrics
  if (Array.isArray(stores.body_metrics)) {
    for (const metric of stores.body_metrics) {
      if (metric) {
        await saveBodyMetric(metric);
        metricsCount += 1;
      }
    }
  }

  // Dispatch refresh events to reactive hooks
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('apexfit:sync-flushed', {
        detail: { flushed: 0, imported: true },
      })
    );
  }

  return {
    success: true,
    imported: {
      sessions: sessionsCount,
      shoes: shoesCount,
      metrics: metricsCount,
    },
  };
};

/* ==========================================================================
   SYNC MANAGER & NETWORK LISTENER
   ========================================================================== */

let isFlushingOutbox = false;

/**
 * Flushes all pending outbox actions to the Google Apps Script endpoint.
 *
 * @param {string} [overrideUrl]
 * @returns {Promise<{ flushed: number, remaining: number, isOffline?: boolean }>}
 */
export const flushSyncOutbox = async (overrideUrl) => {
  if (isFlushingOutbox) {
    return { flushed: 0, remaining: 0, inProgress: true };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { flushed: 0, remaining: 0, isOffline: true };
  }

  const endpointUrl = overrideUrl || getApiUrl();
  if (!endpointUrl) {
    return { flushed: 0, remaining: 0, noEndpoint: true };
  }

  isFlushingOutbox = true;
  let flushedCount = 0;

  try {
    const pending = await getPendingSyncActions();
    if (pending.length === 0) {
      return { flushed: 0, remaining: 0 };
    }

    for (const item of pending) {
      // Build POST body: normalize payload to match Google Sheets column headers
      const normalizedPayload = normalizeOutboxPayload(item.action, item.payload);
      const postBody =
        normalizedPayload && normalizedPayload.action
          ? normalizedPayload
          : { action: item.action, ...normalizedPayload };

      try {
        const response = await fetch(endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: JSON.stringify(postBody),
        });

        if (response.ok) {
          await markSyncActionDone(item.id, true);
          flushedCount += 1;
        } else {
          // Server returned error status; keep in outbox and try later
          console.warn(`Outbox item ${item.id} sync failed with HTTP status ${response.status}`);
          break;
        }
      } catch (networkErr) {
        // Network connectivity dropped during flush
        console.warn('Network error while flushing outbox item:', networkErr);
        break;
      }
    }

    // Emit event so UI can display a badge or refresh data
    if (typeof window !== 'undefined' && flushedCount > 0) {
      window.dispatchEvent(
        new CustomEvent('apexfit:sync-flushed', {
          detail: { flushed: flushedCount },
        })
      );
    }

    const remaining = (await getPendingSyncActions()).length;
    return { flushed: flushedCount, remaining };
  } finally {
    isFlushingOutbox = false;
  }
};

/**
 * Triggers an immediate synchronization flush of all pending outbox actions,
 * pushing local session data to Google Sheets backend.
 *
 * @param {string} [overrideUrl]
 * @returns {Promise<{ flushed: number, remaining: number }>}
 */
export const runAllSyncs = async (overrideUrl) => {
  return flushSyncOutbox(overrideUrl);
};

/**
 * Updates progressive overload reference history from a completed session.
 * Stores the exercise set data in localStorage and returns the updated history map.
 *
 * @param {Object} session
 * @returns {Record<string, Array<{ setNumber: number, weightLbs: number, reps: number, rir?: number }>>}
 */
export const updateProgressiveOverloadFromSession = (session) => {
  if (!session || !Array.isArray(session.exercises)) return {};

  try {
    const cached =
      localStorage.getItem(STORAGE_KEY_OVERLOAD_HISTORY) ||
      localStorage.getItem(LEGACY_STORAGE_KEY_OVERLOAD_HISTORY);
    const existing = cached ? JSON.parse(cached) : {};
    const updated = { ...existing };

    session.exercises.forEach((ex) => {
      const name = ex.exerciseName || ex.name;
      if (!name || !Array.isArray(ex.sets)) return;
      const completedSets = ex.sets.filter((s) => s.completed !== false);
      if (completedSets.length > 0) {
        updated[name] = completedSets.map((s, idx) => ({
          setNumber: idx + 1,
          weightLbs: Number(s.weightLbs || 0),
          reps: Number(s.reps || 0),
          rir: s.rir !== null && s.rir !== undefined && s.rir !== '' ? Number(s.rir) : 2,
        }));
      }
    });

    localStorage.setItem(STORAGE_KEY_OVERLOAD_HISTORY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('updateProgressiveOverloadFromSession error:', err);
    return {};
  }
};

/**
 * Saves and synchronizes an edited workout session:
 * 1. Recalculates metrics (totalVolumeLbs, totalSets, avgRir, duration).
 * 2. Updates the session record in local IndexedDB and localStorage (saveSession).
 * 3. Updates progressive overload reference history (updateProgressiveOverloadFromSession).
 * 4. Queues a normalized 'logWorkoutSession' action in the sync outbox.
 * 5. Triggers an immediate background flush (runAllSyncs).
 * 6. Dispatches 'apexfit:session-updated' custom event.
 *
 * @param {Object} session
 * @returns {Promise<Object>} The updated and persisted session record
 */
export const saveAndSyncEditedSession = async (session) => {
  if (!session) throw new Error('Cannot save an empty session record.');

  const normalizedInput = normalizeSessionRecord(session);
  const exercises = Array.isArray(normalizedInput.exercises) ? normalizedInput.exercises : [];
  const flatSets = [];
  let totalVolumeLbs = 0;
  let totalSets = 0;
  let rirSum = 0;
  let rirCount = 0;

  exercises.forEach((ex) => {
    (ex.sets || []).forEach((s, idx) => {
      const weight = Number(s.weightLbs || 0);
      const reps = Number(s.reps || 0);
      totalVolumeLbs += weight * reps;
      totalSets += 1;
      if (s.rir !== null && s.rir !== undefined && s.rir !== '') {
        rirSum += Number(s.rir);
        rirCount += 1;
      }
      flatSets.push({
        Workout_ID: normalizedInput.sessionId,
        Date: normalizedInput.date,
        Exercise: ex.exerciseName || ex.name || `Exercise ${idx + 1}`,
        Set_Number: s.setNumber ?? idx + 1,
        Weight_Lbs: weight,
        Reps: reps,
        RIR: s.rir !== null && s.rir !== undefined && s.rir !== '' ? Number(s.rir) : null,
        Active_Sec: Number(s.Active_Sec ?? s.active_sec ?? s.setActiveSec ?? s.Set_Active_Sec ?? 0),
        active_sec: Number(s.Active_Sec ?? s.active_sec ?? s.setActiveSec ?? s.Set_Active_Sec ?? 0),
        Set_Active_Sec: Number(s.Active_Sec ?? s.active_sec ?? s.setActiveSec ?? s.Set_Active_Sec ?? 0),
        Rest_After_Sec: Number(s.restAfterSec || 0),
        Completed_At: s.completedAt || getLocalIsoString(),
        exerciseName: ex.exerciseName || ex.name || `Exercise ${idx + 1}`,
        setNumber: s.setNumber ?? idx + 1,
        weightLbs: weight,
        reps,
        rir: s.rir !== null && s.rir !== undefined && s.rir !== '' ? Number(s.rir) : null,
        setActiveSec: Number(s.Active_Sec ?? s.active_sec ?? s.setActiveSec ?? s.Set_Active_Sec ?? 0),
      });
    });
  });

  const avgRir = rirCount > 0 ? Math.round((rirSum / rirCount) * 10) / 10 : normalizedInput.avgRir ?? null;
  const durationMin =
    normalizedInput.Total_Duration_Min != null
      ? Number(normalizedInput.Total_Duration_Min)
      : normalizedInput.durationSec
      ? Math.round((normalizedInput.durationSec / 60) * 10) / 10
      : 0;
  const durationSec = normalizedInput.durationSec ?? Math.round(durationMin * 60);

  const updatedRecord = {
    ...normalizedInput,
    Total_Sets: totalSets,
    totalSets,
    Total_Volume_Lbs: totalVolumeLbs,
    totalVolumeLbs,
    Total_Duration_Min: durationMin,
    durationSec,
    avgRir,
    exercises,
    sets: flatSets,
    updatedAt: getLocalIsoString(),
  };

  // 1. Update session record in local IndexedDB and localStorage
  await saveSession(updatedRecord);

  // 2. Update progressive overload reference history
  updateProgressiveOverloadFromSession(updatedRecord);

  // 3. Queue outbox action and trigger immediate background outbox sync
  await queueSyncAction('logWorkoutSession', {
    action: 'logWorkoutSession',
    session: updatedRecord,
    sets: flatSets,
  });

  await runAllSyncs();

  // 4. Emit event for application state synchronization (with backwards compatibility alias)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('apexfit:session-updated', { detail: updatedRecord })
    );
    window.dispatchEvent(
      new CustomEvent('ironlog:session-updated', { detail: updatedRecord })
    );
  }

  return updatedRecord;
};

/**
 * Initializes a global network listener that flushes the outbox whenever the browser goes online.
 * Also performs an immediate background flush if currently online.
 *
 * @param {Function} [onSyncComplete] - Callback receiving flush results
 * @returns {Function} Cleanup function to remove event listener
 */
export const initSyncManager = (onSyncComplete) => {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = async () => {
    try {
      const result = await flushSyncOutbox();
      if (onSyncComplete && result.flushed > 0) {
        onSyncComplete(result);
      }
    } catch (err) {
      console.warn('Sync outbox flush error on online event:', err);
    }
  };

  window.addEventListener('online', handleOnline);

  // Attempt initial flush if online
  if (navigator.onLine) {
    flushSyncOutbox()
      .then((res) => {
        if (onSyncComplete && res?.flushed > 0) {
          onSyncComplete(res);
        }
      })
      .catch(() => {});
  }

  return () => {
    window.removeEventListener('online', handleOnline);
  };
};

/**
 * React hook for components to subscribe to network connectivity and sync outbox state.
 * Automatically flushes un-synced items when internet is restored and keeps track of pending actions.
 *
 * @param {Function} [onSyncComplete]
 * @returns {{ isOnline: boolean, pendingCount: number, isSyncing: boolean, triggerFlush: Function }}
 */
export const useSyncManager = (onSyncComplete) => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const pending = await getPendingSyncActions();
      setPendingCount(pending.length);
    } catch {
      // ignore
    }
  }, []);

  const triggerFlush = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await flushSyncOutbox();
      await refreshPendingCount();
      if (onSyncComplete && res.flushed > 0) {
        onSyncComplete(res);
      }
      return res;
    } finally {
      setIsSyncing(false);
    }
  }, [onSyncComplete, refreshPendingCount]);

  useEffect(() => {
    let isMounted = true;
    getPendingSyncActions()
      .then((pending) => {
        if (isMounted) {
          setPendingCount(pending.length);
        }
      })
      .catch(() => {});

    const handleOnline = () => {
      setIsOnline(true);
      triggerFlush();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleFlushed = () => {
      refreshPendingCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('apexfit:sync-flushed', handleFlushed);

    // Initial attempt on mount if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      flushSyncOutbox()
        .then((res) => {
          if (isMounted) {
            getPendingSyncActions().then((pending) => {
              if (isMounted) setPendingCount(pending.length);
            });
            if (onSyncComplete && res?.flushed > 0) {
              onSyncComplete(res);
            }
          }
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('apexfit:sync-flushed', handleFlushed);
    };
  }, [triggerFlush, refreshPendingCount, onSyncComplete]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    triggerFlush,
  };
}

export { useWorkouts } from '../hooks/useWorkouts';
export { useShoeTracker } from '../hooks/useShoeTracker';
export { useHistoryLog } from '../hooks/useHistoryLog';

