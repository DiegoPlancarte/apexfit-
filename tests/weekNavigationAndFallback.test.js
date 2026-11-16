import { getExerciseCues, getResistanceBand } from '../src/services/exerciseLibrary';
import {
  getWeekDates,
  formatWeekRange,
  matchSessionToPlanDay,
  isSessionCompatibleWithPlanDay,
} from '../src/components/Dashboard/hooks';
import {
  normalizeWeeklyPlan,
  normalizeSessionRecord,
  reconcileAndMergeSessions,
  ingestBackendSyncBundle,
  STORAGE_KEY_PLAN,
} from '../src/services/api';
import {
  openDB,
  STORES,
  saveSession,
  getSessions,
  clearSyncOutbox,
  queueSyncAction,
  revalidateSessionsAgainstPlan,
  STORAGE_KEY_COMPLETED_DAYS,
  STORAGE_KEY_PERF_METRICS,
  STORAGE_KEY_ACTIVE_WEEK_MONDAY,
} from '../src/services/db';

describe('Week Navigation and Plan Isolation Verification', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Exercise Library Exports Check', () => {
    test('getExerciseCues returns accurate cues for core lifts and generic safety cues for unknown lifts', () => {
      expect(typeof getExerciseCues).toBe('function');
      expect(getExerciseCues('Barbell Bench Press')).toContain('Retract and depress shoulder blades');
      expect(getExerciseCues('Barbell Back Squat')).toContain('Brace abdominal wall');
      expect(getExerciseCues('Romanian Deadlift')).toContain('Hinge back at the hips');
      expect(getExerciseCues('Unknown Movement')).toContain('Maintain controlled tempo');
      expect(getExerciseCues('')).toBe('');
    });

    test('getResistanceBand returns correct band details by id or level name', () => {
      expect(typeof getResistanceBand).toBe('function');
      const xLight = getResistanceBand('hb-ab01-xlight');
      expect(xLight).toBeDefined();
      expect(xLight.level).toBe('X-Light');
      expect(xLight.minTension).toBe(5);
      expect(xLight.maxTension).toBe(30);

      const heavy = getResistanceBand('Heavy');
      expect(heavy).toBeDefined();
      expect(heavy.color).toBe('Purple');
      expect(heavy.maxTension).toBe(135);
    });
  });

  describe('Week Dates and Range Calculations', () => {
    test('getWeekDates correctly calculates Monday to Sunday dates', () => {
      const fixedDate = new Date(2026, 10, 11); // Wednesday Nov 11, 2026
      const week = getWeekDates(fixedDate);

      expect(week).toHaveLength(7);
      expect(week[0].dayNumber).toBe(1);
      expect(week[0].dateStr).toBe('2026-11-09');
      expect(week[6].dateStr).toBe('2026-11-15');
    });

    test('formatWeekRange formats display correctly', () => {
      const monday = new Date(2026, 10, 9);
      const label = formatWeekRange(monday);
      expect(label).toBe('Nov 9 – 15, 2026');
    });
  });

  describe('1. Continuous Plan Storage & Historical Integrity', () => {
    test('treats Plan tab as multi-week append-only store preserving past and future weeks', () => {
      const multiWeekSheetRows = [
        // Past week (Week 1)
        {
          Day_Number: 1,
          Date: '2026-11-02',
          Workout_Title: 'Past Week Lower Body',
          Description: 'Heavy Squats and RDLs',
          Category_Badge: 'Lower Body',
          Exercises_JSON: '[{"exercise":"Barbell Back Squat","target_sets":3,"target_reps":5}]',
        },
        // Current week (Week 2)
        {
          Day_Number: 1,
          Date: '2026-11-09',
          Workout_Title: 'Current Week Lower Body',
          Description: 'Tempo Squats and Lunges',
          Category_Badge: 'Lower Body',
          Exercises_JSON: '[{"exercise":"Goblet Squat","target_sets":3,"target_reps":10}]',
        },
        // Future week (Week 3)
        {
          Day_Number: 1,
          Date: '2026-11-16',
          Workout_Title: 'Future Week Deload',
          Description: 'Light mobility and technique',
          Category_Badge: 'Deload',
          Exercises_JSON: '[{"exercise":"Bodyweight Squat","target_sets":2,"target_reps":12}]',
        },
      ];

      const normalized = normalizeWeeklyPlan(multiWeekSheetRows);
      expect(normalized).toHaveLength(3);
      expect(normalized[0].Workout_Title).toBe('Past Week Lower Body');
      expect(normalized[1].Workout_Title).toBe('Current Week Lower Body');
      expect(normalized[2].Workout_Title).toBe('Future Week Deload');

      // Verify each item retained its distinct calendar date
      expect(normalized[0].date).toBe('2026-11-02');
      expect(normalized[1].date).toBe('2026-11-09');
      expect(normalized[2].date).toBe('2026-11-16');
    });

    test('historical archive cards pull Workout_Title, description, and structure from historical Plan rows', () => {
      const historicalPlan = [
        {
          Day_Number: 1,
          Date: '2026-11-02',
          Workout_Title: 'Historical Strength Benchmark',
          Description: 'Test your 5RM on Bench and Row.',
          Category_Badge: 'Upper Body',
          Exercises_JSON: '[{"exercise":"Barbell Bench Press","target_sets":3,"target_reps":5},{"exercise":"Barbell Row","target_sets":3,"target_reps":6}]',
        },
      ];
      localStorage.setItem(STORAGE_KEY_PLAN, JSON.stringify(normalizeWeeklyPlan(historicalPlan)));

      // Incoming minimal session record without explicit custom name or notes
      const minimalSession = {
        sessionId: 'sess_hist_1',
        date: '2026-11-02',
        startedAt: '2026-11-02T10:00:00',
        workoutName: 'Lifting', // Generic fallback
        notes: '',
        exercises: [],
      };

      const reconciled = reconcileAndMergeSessions([minimalSession]);
      expect(reconciled).toHaveLength(1);
      const card = reconciled[0];

      // Pulled from historical Plan row
      expect(card.workoutName).toBe('Historical Strength Benchmark');
      expect(card.Workout_Title).toBe('Historical Strength Benchmark');
      expect(card.notes).toBe('Test your 5RM on Bench and Row.');
      expect(card.exercises).toHaveLength(2);
      expect(card.exercises[0].exerciseName).toBe('Barbell Bench Press');
      expect(card.exercises[1].exerciseName).toBe('Barbell Row');
    });

    test('normalizeSessionRecord extracts Workout_Title, description, and Exercises_JSON directly', () => {
      const planRowAsSession = {
        Workout_ID: 'sess_plan_direct',
        Date: '2026-11-02',
        Workout_Title: 'Leg Hypertrophy',
        Description: 'High volume leg press and extensions',
        Exercises_JSON: '[{"exercise":"Leg Press","target_sets":4,"target_reps":12}]',
      };

      const normalized = normalizeSessionRecord(planRowAsSession);
      expect(normalized.workoutName).toBe('Leg Hypertrophy');
      expect(normalized.notes).toBe('High volume leg press and extensions');
      expect(normalized.exercises).toHaveLength(1);
      expect(normalized.exercises[0].exerciseName).toBe('Leg Press');
      expect(normalized.exercises[0].sets).toHaveLength(4);
    });
  });

  describe('2. Current Week Default Load on Startup', () => {
    test('identifies current week Monday and today date object on launch', () => {
      const now = new Date();
      const currentDayOfWeek = now.getDay();
      const distToMon = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
      const expectedMonday = new Date(now);
      expectedMonday.setDate(now.getDate() + distToMon);
      expectedMonday.setHours(0, 0, 0, 0);

      const weekDates = getWeekDates(now);
      expect(weekDates).toHaveLength(7);

      const todayItem = weekDates.find((w) => w.isToday);
      expect(todayItem).toBeDefined();
      expect(todayItem.isToday).toBe(true);
      expect(todayItem.dayNumber).toBeGreaterThanOrEqual(1);
      expect(todayItem.dayNumber).toBeLessThanOrEqual(7);
    });
  });

  describe('3. Plan vs. Session Fallback Separation', () => {
    test('generic plan items without explicit calendar dates do not bleed into past or future weeks', () => {
      const genericPlan = [
        { dayNumber: 1, title: 'Upper Body A', activityType: 'workout' },
        { dayNumber: 2, title: 'Easy Aerobic Run', activityType: 'run' },
      ];

      const currentMonday = new Date(2026, 10, 9);
      const pastMonday = new Date(2026, 10, 2);
      const futureMonday = new Date(2026, 10, 16);
      const thisMonday = new Date(2026, 10, 9);

      const resolveRawWeekPlan = (mon, plan) => {
        const isCurrent = mon.getTime() === thisMonday.getTime();
        const weekDates = getWeekDates(mon);
        const weekDateSet = new Set(weekDates.map((w) => w.dateStr));

        // 1. If any plan items have explicit calendar dates matching this week
        const datedItems = plan.filter((item) => {
          const itemDate = item.date || item.Date;
          return itemDate && weekDateSet.has(itemDate);
        });
        if (datedItems.length > 0) return datedItems;

        // 2. Generic undated plan items belong ONLY to the active current week
        if (isCurrent) return plan;

        // 3. For adjacent past/future weeks without dedicated plan records, do NOT duplicate
        return [];
      };

      // Current week resolves generic plan
      expect(resolveRawWeekPlan(currentMonday, genericPlan)).toHaveLength(2);

      // Past week without dated items returns empty array (no duplication)
      expect(resolveRawWeekPlan(pastMonday, genericPlan)).toHaveLength(0);

      // Future week without dated items returns empty array (no duplication)
      expect(resolveRawWeekPlan(futureMonday, genericPlan)).toHaveLength(0);
    });

    test('dated plan items render on their dedicated calendar weeks only', () => {
      const multiWeekPlan = [
        { dayNumber: 1, date: '2026-11-09', title: 'Nov 9 Lifting' },
        { dayNumber: 1, date: '2026-11-16', title: 'Nov 16 Future Lifting' },
      ];

      const weekDatesNov9 = getWeekDates(new Date(2026, 10, 9));
      const setNov9 = new Set(weekDatesNov9.map((w) => w.dateStr));

      const nov9Items = multiWeekPlan.filter((item) => setNov9.has(item.date));
      expect(nov9Items).toHaveLength(1);
      expect(nov9Items[0].title).toBe('Nov 9 Lifting');

      const weekDatesNov16 = getWeekDates(new Date(2026, 10, 16));
      const setNov16 = new Set(weekDatesNov16.map((w) => w.dateStr));

      const nov16Items = multiWeekPlan.filter((item) => setNov16.has(item.date));
      expect(nov16Items).toHaveLength(1);
      expect(nov16Items[0].title).toBe('Nov 16 Future Lifting');
    });
  });

  describe('4. Stale Local Cache Invalidation & Re-validation Against Plan Data', () => {
    beforeEach(async () => {
      await clearSyncOutbox();
      const db = await openDB();
      const tx = db.transaction([STORES.SESSIONS, STORES.SYNC_OUTBOX], 'readwrite');
      tx.objectStore(STORES.SESSIONS).clear();
      tx.objectStore(STORES.SYNC_OUTBOX).clear();
      await new Promise((resolve) => {
        tx.oncomplete = resolve;
      });
    });

    test('invalidates stale localStorage completedDayNumbers and perfMetrics when week rolls over', async () => {
      // Simulate mobile state persisted from previous week (Monday Nov 9, 2026)
      localStorage.setItem(STORAGE_KEY_ACTIVE_WEEK_MONDAY, '2026-11-09');
      localStorage.setItem(STORAGE_KEY_COMPLETED_DAYS, JSON.stringify([1, 2]));
      localStorage.setItem(
        STORAGE_KEY_PERF_METRICS,
        JSON.stringify({ 1: '12,000 lbs total volume • 12 sets' })
      );
      localStorage.setItem(
        STORAGE_KEY_PLAN,
        JSON.stringify([
          { dayNumber: 1, title: 'Upper Body A', activityType: 'workout', status: 'Completed' },
        ])
      );

      // Revalidate on Monday Nov 16, 2026
      const result = await revalidateSessionsAgainstPlan([], {
        referenceDate: '2026-11-16',
      });

      expect(result.weekRolledOver).toBe(true);
      expect(localStorage.getItem(STORAGE_KEY_ACTIVE_WEEK_MONDAY)).toBe('2026-11-16');
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY_COMPLETED_DAYS) || '[]')).toEqual([]);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY_PERF_METRICS) || '{}')).toEqual({});

      const resetPlan = JSON.parse(localStorage.getItem(STORAGE_KEY_PLAN));
      expect(resetPlan[0].status).toBe('Scheduled');
    });

    test('re-validates and removes stale local sessions when latest fetched Plan row is Scheduled, while preserving pending outbox sessions', async () => {
      // 1. Seed a stale cached session for Monday Nov 16 that is NOT in sync_outbox and NOT in backend
      await saveSession({
        sessionId: 'stale_mobile_sess_1',
        date: '2026-11-16',
        workoutName: 'Upper Body Hypertrophy',
        type: 'workout',
        dayNumber: 1,
        totalVolumeLbs: 8500,
        totalSets: 9,
      });

      // 2. Seed an offline session for Tuesday Nov 17 that IS queued in sync_outbox
      const pendingOfflineSess = {
        sessionId: 'pending_offline_sess_2',
        date: '2026-11-17',
        workoutName: 'Lower Body Strength',
        type: 'workout',
        dayNumber: 2,
        totalVolumeLbs: 11200,
        totalSets: 10,
      };
      await saveSession(pendingOfflineSess);
      await queueSyncAction('logWorkoutSession', { session: pendingOfflineSess, sets: [] });

      localStorage.setItem(STORAGE_KEY_COMPLETED_DAYS, JSON.stringify([1, 2]));

      // 3. Backend returns Plan showing both Nov 16 and Nov 17 as "Scheduled"
      const latestPlan = normalizeWeeklyPlan([
        {
          Day_Number: 1,
          Date: '2026-11-16',
          Workout_Title: 'Upper Body Hypertrophy',
          Activity_Type: 'Lifting',
          Status: 'Scheduled',
          Completed_Workout_ID: '',
        },
        {
          Day_Number: 2,
          Date: '2026-11-17',
          Workout_Title: 'Lower Body Strength',
          Activity_Type: 'Lifting',
          Status: 'Scheduled',
          Completed_Workout_ID: '',
        },
      ]);

      const reval = await revalidateSessionsAgainstPlan(latestPlan, {
        referenceDate: '2026-11-16',
        authoritativePlan: true,
      });

      // Day 1 was invalidated and its stale local session removed
      expect(reval.invalidatedDays).toContain(1);
      expect(reval.removedSessionIds).toContain('stale_mobile_sess_1');

      // Day 2 has a pending outbox mutation so it is preserved!
      expect(reval.removedSessionIds).not.toContain('pending_offline_sess_2');

      const remainingSessions = await getSessions();
      expect(remainingSessions.map((s) => s.sessionId)).toEqual(['pending_offline_sess_2']);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY_COMPLETED_DAYS))).toEqual([2]);
    });

    test('ingestBackendSyncBundle reconciles IndexedDB with backend sessions and Scheduled Plan rows', async () => {
      // Seed an orphaned local session not present on backend
      await saveSession({
        sessionId: 'orphan_local_sess',
        date: '2026-11-16',
        workoutName: 'Orphan Workout',
        type: 'workout',
        dayNumber: 1,
      });
      localStorage.setItem(STORAGE_KEY_COMPLETED_DAYS, JSON.stringify([1]));

      await ingestBackendSyncBundle({
        status: 'ok',
        data: {
          plan: [
            {
              Day_Number: 1,
              Date: '2026-11-16',
              Workout_Title: 'Fresh Scheduled Monday',
              Activity_Type: 'Lifting',
              Status: 'Scheduled',
              Completed_Workout_ID: '',
            },
          ],
          sessions: [],
          sets: [],
        },
      });

      const idbSessions = await getSessions();
      expect(idbSessions).toHaveLength(0);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY_COMPLETED_DAYS))).toEqual([]);
    });
  });

  describe('5. Dashboard Session Matching Integrity (Strict Active Week Date Bounds)', () => {
    const nov16WeekDates = getWeekDates(new Date(2026, 10, 16), '2026-11-16');
    const nov16WeekSet = new Set(nov16WeekDates.map((w) => w.dateStr));
    const mondayMeta = nov16WeekDates[0]; // 2026-11-16, dayNumber: 1

    const scheduledMondayCard = {
      dayNumber: 1,
      date: '2026-11-16',
      title: 'Upper Body Hypertrophy',
      activityType: 'workout',
      status: 'Scheduled',
    };

    test('does NOT match historical sessions from previous weeks even when dayNumber, planDayNumber, or workoutName match', () => {
      const lastWeekSession = {
        sessionId: 'sess_prev_week_mon',
        date: '2026-11-09', // Previous week Monday!
        workoutName: 'Upper Body Hypertrophy',
        type: 'workout',
        dayNumber: 1,
        planDayNumber: 1,
        day_index: 1,
        totalVolumeLbs: 14200,
        totalSets: 12,
      };

      const match = matchSessionToPlanDay(
        scheduledMondayCard,
        mondayMeta,
        [lastWeekSession],
        nov16WeekSet
      );

      expect(match).toBeNull();
    });

    test('does NOT match a session with a matching sessionId if the session date falls outside active week bounds', () => {
      const cardWithStaleId = {
        ...scheduledMondayCard,
        completedWorkoutId: 'sess_old_id_1',
      };
      const oldSession = {
        sessionId: 'sess_old_id_1',
        date: '2026-11-02', // 2 weeks ago
        workoutName: 'Upper Body Hypertrophy',
        type: 'workout',
      };

      const match = matchSessionToPlanDay(
        cardWithStaleId,
        mondayMeta,
        [oldSession],
        nov16WeekSet
      );

      expect(match).toBeNull();
    });

    test('does NOT match passive wearable walks or zero-volume wearable entries to scheduled lifting or run cards', () => {
      const passiveWalk = {
        sessionId: 'wearable_walk_1',
        date: '2026-11-16',
        workoutName: 'Walk',
        type: 'walk',
        Workout_Type: 'Walk',
        rawSource: 'Pixel Watch / Google Health',
        distanceMiles: 1.1,
      };

      const runCard = {
        dayNumber: 1,
        date: '2026-11-16',
        title: 'Zone 2 Recovery Run',
        activityType: 'run',
        status: 'Scheduled',
      };

      expect(isSessionCompatibleWithPlanDay(passiveWalk, scheduledMondayCard)).toBe(false);
      expect(isSessionCompatibleWithPlanDay(passiveWalk, runCard)).toBe(false);
      expect(
        matchSessionToPlanDay(runCard, mondayMeta, [passiveWalk], nov16WeekSet)
      ).toBeNull();
    });

    test('correctly matches a valid completed session whose date strictly matches the active week card date', () => {
      const validTodaySession = {
        sessionId: 'sess_today_valid',
        date: '2026-11-16',
        workoutName: 'Upper Body Hypertrophy',
        type: 'workout',
        dayNumber: 1,
        totalVolumeLbs: 15000,
        totalSets: 12,
      };

      const match = matchSessionToPlanDay(
        scheduledMondayCard,
        mondayMeta,
        [validTodaySession],
        nov16WeekSet
      );

      expect(match).not.toBeNull();
      expect(match.sessionId).toBe('sess_today_valid');
    });
  });
});
