import { useEffect, useState, useCallback } from 'react';
import {
  STORAGE_KEY_HISTORY_LOG,
  fetchHistoricalSessions,
  normalizeSessionRecord,
} from '../../services/api';
import { saveSession } from '../../services/db';
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

  // Initial load from backend / IndexedDB (with query params readiness)
  useEffect(() => {
    let isMounted = true;
    fetchHistoricalSessions({
      startDate: viewScope === 'week' ? activeStartDate : undefined,
      endDate: viewScope === 'week' ? activeEndDate : undefined,
    })
      .then((data) => {
        if (isMounted) {
          if (Array.isArray(data)) {
            setSessions(data.map(normalizeSessionRecord));
          }
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn('HistoryLog fetch error:', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeStartDate, activeEndDate, viewScope]);

  // Auto-refresh historical sessions whenever the background sync outbox flushes
  useEffect(() => {
    const handleSyncFlushed = () => {
      fetchHistoricalSessions({
        startDate: viewScope === 'week' ? activeStartDate : undefined,
        endDate: viewScope === 'week' ? activeEndDate : undefined,
      })
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setSessions(data.map(normalizeSessionRecord));
          }
        })
        .catch(() => {});
    };
    window.addEventListener('apexfit:sync-flushed', handleSyncFlushed);
    return () => {
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
      });
      if (Array.isArray(data) && data.length > 0) {
        setSessions(data);
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

  // Filter by activity type: all | workout | run
  const filteredSessions = scopedSessions.filter((s) => {
    if (filterType === 'all') return true;
    if (filterType === 'workout') return s.type !== 'run';
    if (filterType === 'run') return s.type === 'run';
    return true;
  });

  // Aggregated summary stats for the active view
  const totalVolumeLifted = scopedSessions
    .filter((s) => s.type !== 'run')
    .reduce((sum, s) => sum + (Number(s.totalVolumeLbs) || 0), 0);

  const totalMiles = scopedSessions
    .filter((s) => s.type === 'run')
    .reduce((sum, s) => {
      const mi =
        s.distanceMiles != null
          ? Number(s.distanceMiles)
          : s.distanceKm != null
          ? Number(s.distanceKm) * 0.621371
          : 0;
      return sum + (Number.isFinite(mi) ? mi : 0);
    }, 0);

  const totalRunsCount = scopedSessions.filter((s) => s.type === 'run').length;
  const totalWorkoutsCount = scopedSessions.filter((s) => s.type !== 'run').length;

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
