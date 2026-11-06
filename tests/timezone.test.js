import {
  getLocalDateString,
  getLocalIsoString,
  parseLocalDate,
  formatFriendlyLocalDate,
  isSameLocalDate,
} from '../src/utils/date';
import { buildWorkoutPayload, buildRunPayload } from '../src/services/api';
import {
  saveSession,
  getSessionById,
  normalizeOutboxPayload,
  queueSyncAction,
  getPendingSyncActions,
  clearSyncOutbox,
  openDB,
  STORES,
} from '../src/services/db';
import { getWeekDates } from '../src/components/Dashboard/hooks';

describe('Local Timezone Handling & Timestamp Integrity', () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearSyncOutbox();
    const db = await openDB();
    const tx = db.transaction([STORES.SESSIONS, STORES.SYNC_OUTBOX], 'readwrite');
    tx.objectStore(STORES.SESSIONS).clear();
    tx.objectStore(STORES.SYNC_OUTBOX).clear();
    await new Promise((resolve) => {
      tx.oncomplete = resolve;
    });
  });

  describe('Local Date & ISO String Generation', () => {
    it('accurately extracts local YYYY-MM-DD during late evening hours without rolling over to UTC tomorrow', () => {
      // Construct a Date object representing 11:45 PM on November 5, 2026 local time
      const lateEveningDate = new Date(2026, 10, 5, 23, 45, 0); // month 10 = November
      const localDateStr = getLocalDateString(lateEveningDate);

      expect(localDateStr).toBe('2026-11-05');
      // If toISOString() were used in UTC-8 (Pacific), UTC would be Nov 6 (07:45 UTC)
      // getLocalDateString strictly preserves local Nov 5:
      expect(localDateStr).not.toBe('2026-11-06');
    });

    it('generates full local ISO timestamp with local timezone offset', () => {
      const localDate = new Date(2026, 10, 5, 19, 30, 0);
      const isoStr = getLocalIsoString(localDate);

      // Must start with local calendar date and time
      expect(isoStr.startsWith('2026-11-05T19:30:00.000')).toBe(true);

      const offsetMinutes = -localDate.getTimezoneOffset();
      if (offsetMinutes === 0) {
        expect(isoStr.endsWith('Z')).toBe(true);
      } else {
        const sign = offsetMinutes >= 0 ? '+' : '-';
        expect(isoStr).toContain(sign);
      }
    });

    it('correctly parses YYYY-MM-DD into local midnight avoiding the UTC -1 day shift', () => {
      const parsed = parseLocalDate('2026-11-05');
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(10); // November
      expect(parsed.getDate()).toBe(5);
      expect(parsed.getHours()).toBe(0);
      expect(parsed.getMinutes()).toBe(0);
    });

    it('formats friendly local date strings consistently for UI display', () => {
      const formatted = formatFriendlyLocalDate('2026-11-05');
      expect(formatted).toContain('Nov 5, 2026');
      expect(formatted).toContain('Thu');
    });

    it('identifies same local calendar date correctly', () => {
      const date1 = new Date(2026, 10, 5, 8, 0, 0);
      const date2 = new Date(2026, 10, 5, 23, 30, 0);
      const nextDay = new Date(2026, 10, 6, 1, 0, 0);

      expect(isSameLocalDate(date1, date2)).toBe(true);
      expect(isSameLocalDate(date1, '2026-11-05')).toBe(true);
      expect(isSameLocalDate(date1, nextDay)).toBe(false);
    });
  });

  describe('Payload Consistency & Outbox Normalization with Local Time', () => {
    it('sets local Date and timestamps when building workout payload without rolling to UTC', () => {
      // Simulate workout completed at 8:00 PM local time
      const eveningDate = new Date(2026, 10, 5, 20, 0, 0);
      const eveningIso = getLocalIsoString(eveningDate);

      const workoutState = {
        sessionId: 'sess_evening_test_1',
        startedAt: eveningIso,
        endedAt: eveningIso,
        workoutName: 'Evening Bench PR Session',
        exercises: [
          {
            exerciseName: 'Barbell Bench Press',
            sets: [{ setNumber: 1, weightLbs: 225, reps: 5, completed: true }],
          },
        ],
      };

      const payload = buildWorkoutPayload(workoutState);

      expect(payload.session.Date).toBe('2026-11-05');
      expect(payload.session.date).toBe('2026-11-05');
      expect(payload.session.created_at).toBe(eveningIso);
      expect(payload.sets[0].Date).toBe('2026-11-05');
    });

    it('builds run payload with local calendar date and timestamps', () => {
      const eveningDate = new Date(2026, 10, 5, 21, 15, 0);
      const eveningIso = getLocalIsoString(eveningDate);

      const runData = {
        sessionId: 'run_evening_test_1',
        startedAt: eveningIso,
        endedAt: eveningIso,
        title: 'Night Recovery Run',
        distanceMiles: 4.0,
        durationSec: 1800,
      };

      const payload = buildRunPayload(runData);

      expect(payload.session.Date).toBe('2026-11-05');
      expect(payload.session.Started_At).toBe(eveningIso);
    });

    it('normalizes outbox payload and assigns local Date header when omitted', () => {
      const rawPayload = {
        action: 'logWorkoutSession',
        sessionId: 'sess_outbox_local_test',
        workoutName: 'Deadlift Day',
        sets: [{ exerciseName: 'Deadlift', setNumber: 1, weightLbs: 315, reps: 5 }],
      };

      const normalized = normalizeOutboxPayload('logWorkoutSession', rawPayload);
      const todayStr = getLocalDateString();

      expect(normalized.session.Date).toBe(todayStr);
      expect(normalized.session.date).toBe(todayStr);
      expect(normalized.sets[0].Date).toBe(todayStr);
    });

    it('saves session to IndexedDB with local date headers and retrieves accurately', async () => {
      const session = {
        sessionId: 'sess_db_tz_test',
        date: '2026-11-05',
        workoutName: 'Evening Push',
        type: 'workout',
        exercises: [
          {
            exerciseName: 'Overhead Press',
            sets: [{ setNumber: 1, weightLbs: 135, reps: 6 }],
          },
        ],
      };

      await saveSession(session);

      const retrieved = await getSessionById('sess_db_tz_test');
      expect(retrieved).not.toBeNull();
      expect(retrieved.date).toBe('2026-11-05');
      expect(retrieved.Date).toBe('2026-11-05');
      expect(retrieved.created_at).toBeDefined();
    });

    it('records local ISO timestamps on outbox queue actions', async () => {
      await queueSyncAction('logWorkoutSession', {
        sessionId: 'sess_queue_tz_test',
        date: '2026-11-05',
      });

      const pending = await getPendingSyncActions();
      expect(pending).toHaveLength(1);
      expect(pending[0].timestamp).toBeDefined();
      expect(typeof pending[0].timestamp).toBe('string');
    });
  });

  describe('Dashboard Weekly Calendar Local Time Resolution', () => {
    it('resolves isToday flag strictly matching local date', () => {
      const weekDates = getWeekDates();
      expect(weekDates).toHaveLength(7);

      const todayStr = getLocalDateString();
      const todayEntry = weekDates.find((w) => w.isToday);

      expect(todayEntry).toBeDefined();
      expect(todayEntry.dateStr).toBe(todayStr);
    });
  });
});
