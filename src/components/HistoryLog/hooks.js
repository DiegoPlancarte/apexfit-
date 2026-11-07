import { useEffect, useState, useCallback } from 'react';
import {
  STORAGE_KEY_HISTORY_LOG,
  fetchHistoricalSessions,
  normalizeSessionRecord,
} from '../../services/api';
import { getSessions, saveSession } from '../../services/db';
import { formatFriendlyLocalDate, getLocalDateString } from '../../utils/date';
import { formatDuration } from '../../utils/format';

export { formatDuration };

export const formatFriendlyDate = (dateStr) => {
  if (!dateStr) return '';
  return formatFriendlyLocalDate(dateStr);
};

export const formatDateToIso = (d) => {
  return getLocalDateString(d);
};

export const getMondayOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0 is Sun, 1 is Mon...
  const distance = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + distance);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getSundayOfWeek = (monday) => {
  const d = new Date(monday);
  d.setDate(monday.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const formatWeekRangeDisplay = (startIso, endIso) => {
  if (!startIso || !endIso) return '';
  const d1 = new Date(startIso + 'T00:00:00');
  const d2 = new Date(endIso + 'T00:00:00');
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) {
    return `${startIso} – ${endIso}`;
  }

  const sameYear = d1.getFullYear() === d2.getFullYear();
  const sameMonth = sameYear && d1.getMonth() === d2.getMonth();

  if (sameMonth) {
    return `${d1.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${d2.getDate()}, ${d2.getFullYear()}`;
  }

  if (sameYear) {
    return `${d1.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${d2.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  return `${d1.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${d2.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
};

export const useComponentLogic = () => {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Track the Monday of the currently selected week window
  const [currentMonday, setCurrentMonday] = useState(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY_HISTORY_LOG);
      const list = cached ? JSON.parse(cached) : [];
      if (Array.isArray(list) && list.length > 0) {
        const sorted = [...list].sort((a, b) => {
          const tA = new Date(a.date || a.startedAt || 0).getTime();
          const tB = new Date(b.date || b.startedAt || 0).getTime();
          return tB - tA;
        });
        const latestDate = sorted[0]?.date || (sorted[0]?.startedAt ? sorted[0].startedAt.split('T')[0] : null);
        if (latestDate) {
          return getMondayOfWeek(new Date(latestDate + 'T00:00:00'));
        }
      }
    } catch {
      // fallback
    }
    return getMondayOfWeek(new Date());
  });

  // View scope: 'week' (paginated weekly window) or 'all' (all historical logs)
  const [viewScope, setViewScope] = useState('week');

  const [expandedSessionIds, setExpandedSessionIds] = useState({});
  const [filterType, setFilterType] = useState('all'); // 'all' | 'workout' | 'run'
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeStartDate = formatDateToIso(currentMonday);
  const activeEndDate = formatDateToIso(getSundayOfWeek(currentMonday));
  const activeDateRangeLabel = formatWeekRangeDisplay(activeStartDate, activeEndDate);

  const todayMondayIso = formatDateToIso(getMondayOfWeek(new Date()));
  const isCurrentWeek = activeStartDate === todayMondayIso;

  // Load archive strictly from local IndexedDB (zero network requests on tab navigation)
  useEffect(() => {
    let isMounted = true;
    const loadArchive = async () => {
      try {
        const queryOpts = {
          startDate: viewScope === 'week' ? activeStartDate : undefined,
          endDate: viewScope === 'week' ? activeEndDate : undefined,
        };

        const local = await getSessions(queryOpts);
        if (!isMounted) return;
        if (Array.isArray(local) && local.length > 0) {
          setSessions(local.map(normalizeSessionRecord));
          setIsLoading(false);
          return;
        }

        // Check if IndexedDB has any historical records overall
        const allLocal = await getSessions();
        if (!isMounted) return;
        if (Array.isArray(allLocal) && allLocal.length > 0) {
          // Local database has records, but this specific date range has none
          setSessions([]);
          setIsLoading(false);
          return;
        }

        // Automated fallback (Condition d): local DB is completely empty
        const remoteData = await fetchHistoricalSessions({
          ...queryOpts,
          forceNetwork: false,
        });
        if (isMounted) {
          if (Array.isArray(remoteData)) {
            setSessions(remoteData.map(normalizeSessionRecord));
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('HistoryLog local read error:', err);
        if (isMounted) setIsLoading(false);
      }
    };

    loadArchive();

    return () => {
      isMounted = false;
    };
  }, [activeStartDate, activeEndDate, viewScope]);

  // When background sync outbox flushes, reload strictly from local IndexedDB (zero network requests)
  useEffect(() => {
    let isMounted = true;
    const handleSyncFlushed = async () => {
      try {
        const queryOpts = {
          startDate: viewScope === 'week' ? activeStartDate : undefined,
          endDate: viewScope === 'week' ? activeEndDate : undefined,
        };
        const local = await getSessions(queryOpts);
        if (isMounted && Array.isArray(local)) {
          setSessions(local.map(normalizeSessionRecord));
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('apexfit:sync-flushed', handleSyncFlushed);
    return () => {
      isMounted = false;
      window.removeEventListener('apexfit:sync-flushed', handleSyncFlushed);
    };
  }, [activeStartDate, activeEndDate, viewScope]);

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
    setViewScope('week');
  }, []);

  const handleJumpToDate = useCallback((dateStr) => {
    if (!dateStr) return;
    const d = new Date(dateStr + 'T00:00:00');
    if (!Number.isNaN(d.getTime())) {
      setCurrentMonday(getMondayOfWeek(d));
      setViewScope('week');
    }
  }, []);

  const handleToggleExpand = useCallback((sessionId) => {
    setExpandedSessionIds((prev) => ({
      ...prev,
      [sessionId]: !prev[sessionId],
    }));
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const data = await fetchHistoricalSessions({
        startDate: viewScope === 'week' ? activeStartDate : undefined,
        endDate: viewScope === 'week' ? activeEndDate : undefined,
        forceNetwork: true,
      });
      if (Array.isArray(data)) {
        setSessions(data.map(normalizeSessionRecord));
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Sort sessions reverse-chronologically (newest at the top)
  const sortedSessions = [...sessions].sort((a, b) => {
    const timeA = new Date(a.date || a.startedAt || 0).getTime();
    const timeB = new Date(b.date || b.startedAt || 0).getTime();
    return timeB - timeA;
  });

  // Filter sessions by active date window (if in 'week' scope)
  const scopedSessions = sortedSessions.filter((s) => {
    if (viewScope === 'all') return true;
    const sDate = s.date || (s.startedAt ? s.startedAt.split('T')[0] : '');
    if (!sDate) return false;
    return sDate >= activeStartDate && sDate <= activeEndDate;
  });

  const isLifting = (s) =>
    s.type === 'workout' ||
    s.type === 'lifting' ||
    s.Workout_Type === 'Lifting' ||
    s.Workout_Type === 'Strength' ||
    Number(s.totalVolumeLbs) > 0;

  const isCardio = (s) => !isLifting(s);

  // Filter by activity type: all | workout | run
  const filteredSessions = scopedSessions.filter((s) => {
    if (filterType === 'all') return true;
    if (filterType === 'workout') return isLifting(s);
    if (filterType === 'run') return isCardio(s);
    return true;
  });

  // Aggregated summary stats for the active view
  const totalVolumeLifted = scopedSessions
    .filter(isLifting)
    .reduce((sum, s) => sum + (Number(s.totalVolumeLbs) || 0), 0);

  const totalMiles = scopedSessions
    .filter(isCardio)
    .reduce((sum, s) => {
      const mi =
        s.distanceMiles != null
          ? Number(s.distanceMiles)
          : s.distanceKm != null
          ? Number(s.distanceKm) * 0.621371
          : 0;
      return sum + (Number.isFinite(mi) ? mi : 0);
    }, 0);

  const totalRunsCount = scopedSessions.filter(isCardio).length;
  const totalWorkoutsCount = scopedSessions.filter(isLifting).length;

  const [selectedRunForDetails, setSelectedRunForDetails] = useState(null);
  const [selectedLiftingForReview, setSelectedLiftingForReview] = useState(null);
  const [isShoeTrackerOpen, setIsShoeTrackerOpen] = useState(false);

  const handleOpenRunDetails = useCallback((session) => {
    setSelectedRunForDetails(session);
  }, []);

  const handleCloseRunDetails = useCallback(() => {
    setSelectedRunForDetails(null);
  }, []);

  const handleOpenSessionReview = useCallback((session) => {
    if (session) {
      setSelectedLiftingForReview(normalizeSessionRecord(session));
    }
  }, []);

  const handleCloseSessionReview = useCallback(() => {
    setSelectedLiftingForReview(null);
  }, []);

  const handleOpenShoeTracker = useCallback(() => {
    setIsShoeTrackerOpen(true);
  }, []);

  const handleCloseShoeTracker = useCallback(() => {
    setIsShoeTrackerOpen(false);
  }, []);

  const handleUpdateSession = useCallback((updatedSession) => {
    if (!updatedSession) return;
    const normalized = normalizeSessionRecord(updatedSession);
    setSessions((prev) =>
      prev.map((s) => (s.sessionId === normalized.sessionId ? normalized : s))
    );
    saveSession(normalized).catch(() => {});
    setSelectedLiftingForReview(null);
  }, []);

  // Listen for session updates from SessionReviewModal or elsewhere
  useEffect(() => {
    const handleSessionUpdated = (e) => {
      const updated = e?.detail;
      if (updated && updated.sessionId) {
        const normalized = normalizeSessionRecord(updated);
        setSessions((prev) =>
          prev.map((s) => (s.sessionId === normalized.sessionId ? normalized : s))
        );
      }
    };
    window.addEventListener('apexfit:session-updated', handleSessionUpdated);
    return () => {
      window.removeEventListener('apexfit:session-updated', handleSessionUpdated);
    };
  }, []);

  const isSessionExpanded = (sessionId) => {
    return Boolean(expandedSessionIds[sessionId]);
  };

  return {
    sessions: filteredSessions,
    allSessionsCount: sessions.length,
    scopedSessionsCount: scopedSessions.length,
    totalWorkoutsCount,
    totalRunsCount,
    totalVolumeLifted,
    totalMiles,
    isLoading,
    activeStartDate,
    activeEndDate,
    activeDateRangeLabel,
    isCurrentWeek,
    viewScope,
    setViewScope,
    handlePrevWeek,
    handleNextWeek,
    handleJumpToToday,
    handleJumpToDate,
    expandedSessionIds,
    isSessionExpanded,
    filterType,
    setFilterType,
    isRefreshing,
    selectedRunForDetails,
    selectedLiftingForReview,
    isShoeTrackerOpen,
    handleOpenRunDetails,
    handleCloseRunDetails,
    handleOpenSessionReview,
    handleCloseSessionReview,
    handleOpenShoeTracker,
    handleCloseShoeTracker,
    handleUpdateSession,
    handleToggleExpand,
    handleRefresh,
    formatDuration,
    formatFriendlyDate,
  };
}
