/**
 * useHistoryLog Hook
 *
 * Asynchronously manages the reverse-chronological archive of past workouts and runs,
 * week-by-week pagination, metric aggregates, and local-first session updates backed by IndexedDB.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getSessions,
  saveSession as dbSaveSession,
  deleteSession as dbDeleteSession,
  queueSyncAction,
  flushSyncOutbox,
  ensureDatabaseSeeded,
} from '../services/db';

export const getMondayOfWeek = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const getSundayOfWeek = (mondayDate) => {
  const sunday = new Date(mondayDate);
  sunday.setDate(mondayDate.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
};

export const formatDateToIso = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatWeekRangeDisplay = (startIso, endIso) => {
  if (!startIso || !endIso) return '';
  const s = new Date(startIso + 'T00:00:00');
  const e = new Date(endIso + 'T00:00:00');
  const sMonth = s.toLocaleDateString('en-US', { month: 'short' });
  const sDay = s.getDate();
  const eMonth = e.toLocaleDateString('en-US', { month: 'short' });
  const eDay = e.getDate();
  const eYear = e.getFullYear();

  if (sMonth === eMonth) {
    return `${sMonth} ${sDay} – ${eDay}, ${eYear}`;
  }
  return `${sMonth} ${sDay} – ${eMonth} ${eDay}, ${eYear}`;
};

export const useHistoryLog = () => {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMonday, setCurrentMonday] = useState(() => getMondayOfWeek(new Date()));
  const [viewScope, setViewScope] = useState('week'); // 'week' | 'all'
  const [filterType, setFilterType] = useState('all'); // 'all' | 'workout' | 'run'
  const [expandedSessionIds, setExpandedSessionIds] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeStartDate = formatDateToIso(currentMonday);
  const activeEndDate = formatDateToIso(getSundayOfWeek(currentMonday));
  const activeDateRangeLabel = formatWeekRangeDisplay(activeStartDate, activeEndDate);

  const todayMondayIso = formatDateToIso(getMondayOfWeek(new Date()));
  const isCurrentWeek = activeStartDate === todayMondayIso;

  const loadSessions = useCallback(async () => {
    try {
      await ensureDatabaseSeeded();
      const allSessions = await getSessions();
      setSessions(allSessions);

      // If viewing for the first time, center on newest recorded session if available
      if (allSessions.length > 0) {
        const latest = allSessions[0];
        const latestDate = latest?.date || (latest?.startedAt ? latest.startedAt.split('T')[0] : null);
        if (latestDate) {
          setCurrentMonday((prev) => {
            const currentIso = formatDateToIso(prev);
            const targetMonday = getMondayOfWeek(new Date(latestDate + 'T00:00:00'));
            // Only adopt if still on the initial today Monday
            return currentIso === todayMondayIso ? targetMonday : prev;
          });
        }
      }
    } catch (err) {
      console.warn('useHistoryLog loadSessions error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [todayMondayIso]);

  useEffect(() => {
    let isMounted = true;
    ensureDatabaseSeeded()
      .then(() => getSessions())
      .then((allSessions) => {
        if (isMounted) {
          setSessions(allSessions);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn('useHistoryLog mount error:', err);
        if (isMounted) setIsLoading(false);
      });

    const handleFlushed = () => {
      loadSessions();
    };

    window.addEventListener('apexfit:sync-flushed', handleFlushed);
    return () => {
      isMounted = false;
      window.removeEventListener('apexfit:sync-flushed', handleFlushed);
    };
  }, [loadSessions]);

  // Filter sessions by week window and activity type
  const scopedSessions = useMemo(() => {
    if (viewScope === 'all') return sessions;
    return sessions.filter((s) => {
      const sDate = s.date || (s.startedAt ? s.startedAt.split('T')[0] : '');
      if (!sDate) return true;
      return sDate >= activeStartDate && sDate <= activeEndDate;
    });
  }, [sessions, viewScope, activeStartDate, activeEndDate]);

  const filteredSessions = useMemo(() => {
    if (filterType === 'all') return scopedSessions;
    return scopedSessions.filter((s) => s.type === filterType);
  }, [scopedSessions, filterType]);

  // Aggregate stats
  const totalWorkoutsCount = useMemo(() => {
    return scopedSessions.filter((s) => s.type !== 'run').length;
  }, [scopedSessions]);

  const totalRunsCount = useMemo(() => {
    return scopedSessions.filter((s) => s.type === 'run').length;
  }, [scopedSessions]);

  const totalVolumeLifted = useMemo(() => {
    return scopedSessions
      .filter((s) => s.type !== 'run')
      .reduce((sum, s) => sum + (Number(s.totalVolumeLbs) || 0), 0);
  }, [scopedSessions]);

  const totalMiles = useMemo(() => {
    const raw = scopedSessions
      .filter((s) => s.type === 'run')
      .reduce((sum, s) => {
        const mi = s.distanceMiles != null ? Number(s.distanceMiles) : Number(s.distanceKm || 0) * 0.621371;
        return sum + (Number.isFinite(mi) ? mi : 0);
      }, 0);
    return Math.round(raw * 10) / 10;
  }, [scopedSessions]);

  // Week navigation
  const handlePrevWeek = useCallback(() => {
    setCurrentMonday((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() - 7);
      return next;
    });
  }, []);

  const handleNextWeek = useCallback(() => {
    setCurrentMonday((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + 7);
      return next;
    });
  }, []);

  const handleJumpToToday = useCallback(() => {
    setCurrentMonday(getMondayOfWeek(new Date()));
  }, []);

  const handleToggleExpand = useCallback((sessionId) => {
    setExpandedSessionIds((prev) => ({
      ...prev,
      [sessionId]: !prev[sessionId],
    }));
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadSessions();
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await flushSyncOutbox();
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [loadSessions]);

  /**
   * Local-first session update: writes to IndexedDB first, queues sync action.
   */
  const handleUpdateSession = useCallback(async (updatedSession) => {
    if (!updatedSession) return;
    await dbSaveSession(updatedSession);
    await queueSyncAction('updateSession', { session: updatedSession });

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      flushSyncOutbox().catch(() => {});
    }

    setSessions((prev) =>
      prev.map((s) => (s.sessionId === updatedSession.sessionId ? updatedSession : s))
    );
  }, []);

  /**
   * Local-first session deletion: writes to IndexedDB first, queues sync action.
   */
  const handleDeleteSession = useCallback(async (sessionId) => {
    if (!sessionId) return;
    await dbDeleteSession(sessionId);
    await queueSyncAction('deleteSession', { sessionId });

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      flushSyncOutbox().catch(() => {});
    }

    setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
  }, []);

  return {
    sessions: filteredSessions,
    allSessionsCount: sessions.length,
    scopedSessionsCount: scopedSessions.length,
    totalWorkoutsCount,
    totalRunsCount,
    totalVolumeLifted,
    totalMiles,
    isLoading,
    isCurrentWeek,
    activeStartDate,
    activeEndDate,
    activeDateRangeLabel,
    viewScope,
    setViewScope,
    filterType,
    setFilterType,
    expandedSessionIds,
    isRefreshing,
    handlePrevWeek,
    handleNextWeek,
    handleJumpToToday,
    handleToggleExpand,
    handleRefresh,
    handleUpdateSession,
    handleDeleteSession,
  };
}
