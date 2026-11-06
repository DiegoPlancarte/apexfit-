/**
 * useWorkouts Hook
 *
 * Asynchronously manages lifting workout sessions, progressive overload history,
 * and local-first mutations backed by IndexedDB and the offline sync outbox.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getSessions,
  saveSession as dbSaveSession,
  deleteSession as dbDeleteSession,
  queueSyncAction,
  flushSyncOutbox,
  ensureDatabaseSeeded,
  extractProgressiveOverloadHistory,
} from '../services/db';
import { buildWorkoutPayload } from '../services/api';

export const useWorkouts = () => {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSessionHistory, setLastSessionHistory] = useState({});

  const refreshWorkouts = useCallback(async () => {
    try {
      await ensureDatabaseSeeded();
      const loaded = await getSessions();
      setSessions(loaded);
      setLastSessionHistory(extractProgressiveOverloadHistory(loaded));
    } catch (err) {
      console.warn('useWorkouts failed to load sessions from IndexedDB:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    ensureDatabaseSeeded()
      .then(() => getSessions())
      .then((loaded) => {
        if (isMounted) {
          setSessions(loaded);
          setLastSessionHistory(extractProgressiveOverloadHistory(loaded));
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn('useWorkouts mount hydration error:', err);
        if (isMounted) setIsLoading(false);
      });

    const handleFlushed = () => {
      refreshWorkouts();
    };

    window.addEventListener('apexfit:sync-flushed', handleFlushed);
    return () => {
      isMounted = false;
      window.removeEventListener('apexfit:sync-flushed', handleFlushed);
    };
  }, [refreshWorkouts]);

  /**
   * Local-first workout saver:
   * 1. Persists session directly to IndexedDB.
   * 2. Queues action in sync_outbox.
   * 3. Triggers background flush if online.
   * 4. Updates reactive state immediately.
   */
  const saveWorkout = useCallback(
    async (workoutData) => {
      const payload = workoutData?.schemaVersion
        ? workoutData
        : buildWorkoutPayload(workoutData);

      // 1. Write directly to IndexedDB first
      const saved = await dbSaveSession(payload.session);

      // 2. Queue mutation in sync_outbox
      await queueSyncAction('logWorkoutSession', payload);

      // 3. Attempt immediate background flush if online
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        flushSyncOutbox().catch(() => {});
      }

      // 4. Update reactive sessions state & overload history
      setSessions((prev) => [saved, ...prev.filter((s) => s.sessionId !== saved.sessionId)]);
      setLastSessionHistory((prev) => {
        const updated = { ...prev };
        if (Array.isArray(workoutData?.exercises)) {
          workoutData.exercises.forEach((ex) => {
            const completed = (ex.sets || []).filter((s) => s.completed);
            if (completed.length > 0) {
              updated[ex.exerciseName] = completed.map((s, idx) => ({
                setNumber: idx + 1,
                weightLbs: Number(s.weightLbs || 0),
                reps: Number(s.reps || 0),
                rir: s.rir ?? 2,
              }));
            }
          });
        }
        return updated;
      });

      return { session: saved, payload };
    },
    []
  );

  /**
   * Local-first workout deletion
   */
  const deleteWorkout = useCallback(async (sessionId) => {
    await dbDeleteSession(sessionId);
    await queueSyncAction('deleteWorkoutSession', { sessionId });

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      flushSyncOutbox().catch(() => {});
    }

    setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
  }, []);

  return {
    sessions,
    isLoading,
    lastSessionHistory,
    saveWorkout,
    deleteWorkout,
    refreshWorkouts,
  };
}
