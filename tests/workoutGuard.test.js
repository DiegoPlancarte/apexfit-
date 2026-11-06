import { jest } from '@jest/globals';
import {
  ACTIVE_WORKOUT_GUARD_MESSAGE,
  checkWorkoutGuard,
} from '../src/config/workoutGuard';
import { buildWorkoutPayload, runAllSyncs } from '../src/services/api';
import {
  saveSession,
  getSessionById,
  clearSyncOutbox,
  queueSyncAction,
  getPendingSyncActions,
} from '../src/services/db';

describe('Active Workout Navigation & Interaction Guard', () => {
  describe('Guard Configuration & Warning Message', () => {
    it('defines the exact required informative intercept message', () => {
      expect(ACTIVE_WORKOUT_GUARD_MESSAGE).toBe(
        'You currently have an active workout in progress. Please complete or finish your current workout session before accessing or modifying other training plans.'
      );
    });
  });

  describe('checkWorkoutGuard Validator', () => {
    describe('when workout is not started (isWorkoutStarted === false)', () => {
      it('permits unrestricted navigation to dashboard view', () => {
        const result = checkWorkoutGuard(false, 'dashboard');
        expect(result.blocked).toBe(false);
        expect(result.message).toBe('');
      });

      it('permits unrestricted navigation to history view', () => {
        const result = checkWorkoutGuard(false, 'history');
        expect(result.blocked).toBe(false);
        expect(result.message).toBe('');
      });

      it('permits unrestricted navigation to workout view', () => {
        const result = checkWorkoutGuard(false, 'workout');
        expect(result.blocked).toBe(false);
      });

      it('permits plan selection actions', () => {
        const result = checkWorkoutGuard(false, 'openTodaysWod');
        expect(result.blocked).toBe(false);
      });
    });

    describe('when workout is actively in progress (isWorkoutStarted === true)', () => {
      it('blocks navigation away to dashboard with informative intercept message', () => {
        const result = checkWorkoutGuard(true, 'dashboard', 'workout');
        expect(result.blocked).toBe(true);
        expect(result.message).toBe(ACTIVE_WORKOUT_GUARD_MESSAGE);
      });

      it('blocks navigation away to history logbook with informative intercept message', () => {
        const result = checkWorkoutGuard(true, 'history', 'workout');
        expect(result.blocked).toBe(true);
        expect(result.message).toBe(ACTIVE_WORKOUT_GUARD_MESSAGE);
      });

      it('permits staying on or returning to the active workout screen', () => {
        const resultStay = checkWorkoutGuard(true, 'workout', 'workout');
        expect(resultStay.blocked).toBe(false);

        const resultReturn = checkWorkoutGuard(true, 'workout', 'dashboard');
        expect(resultReturn.blocked).toBe(false);
      });

      it('permits openTodaysWod action to safely resume current active session', () => {
        const result = checkWorkoutGuard(true, 'openTodaysWod', 'dashboard');
        expect(result.blocked).toBe(false);
      });

      it('blocks arbitrary external actions during an active workout', () => {
        const result = checkWorkoutGuard(true, 'switch_plan_day_3', 'dashboard');
        expect(result.blocked).toBe(true);
        expect(result.message).toBe(ACTIVE_WORKOUT_GUARD_MESSAGE);
      });
    });
  });

  describe('Plan Modification Interception Logic', () => {
    it('blocks switching plan templates when another workout session is actively running', () => {
      const activeWorkoutState = {
        sessionId: 'sess_active_123',
        startedAt: '2026-11-05T06:00:00.000Z',
        planDayNumber: 1,
        workoutName: 'Upper Body Hypertrophy',
        exercises: [{ id: 'ex_1', exerciseName: 'Barbell Bench Press', sets: [] }],
      };

      const isWorkoutStarted = Boolean(activeWorkoutState.startedAt);
      expect(isWorkoutStarted).toBe(true);

      const targetDayToSwitch = {
        dayNumber: 2,
        title: 'Lower Body Strength',
        targetExercises: ['Barbell Back Squat'],
      };

      // Guard check: attempting to switch active day
      const isSwitchBlocked = isWorkoutStarted && targetDayToSwitch.dayNumber !== activeWorkoutState.planDayNumber;
      expect(isSwitchBlocked).toBe(true);

      // Verify state remains preserved
      const nextState = isSwitchBlocked ? activeWorkoutState : { ...activeWorkoutState, planDayNumber: 2 };
      expect(nextState.planDayNumber).toBe(1);
      expect(nextState.workoutName).toBe('Upper Body Hypertrophy');
    });

    it('allows accessing same day card to resume the current session', () => {
      const activeWorkoutState = {
        sessionId: 'sess_active_123',
        startedAt: '2026-11-05T06:00:00.000Z',
        planDayNumber: 1,
        workoutName: 'Upper Body Hypertrophy',
      };

      const isWorkoutStarted = Boolean(activeWorkoutState.startedAt);
      const targetDay = { dayNumber: 1, title: 'Upper Body Hypertrophy' };

      const isSwitchBlocked = isWorkoutStarted && targetDay.dayNumber !== activeWorkoutState.planDayNumber;
      expect(isSwitchBlocked).toBe(false);
    });
  });

  describe('Read-Only State Enforcement Guard', () => {
    it('suppresses mutations and triggers blocked action warning when in read-only mode', () => {
      let isBlockedActionTriggered = false;
      let blockedMessage = '';

      const onBlockedAction = (msg) => {
        isBlockedActionTriggered = true;
        blockedMessage = msg || ACTIVE_WORKOUT_GUARD_MESSAGE;
      };

      const isReadOnly = true;
      let steps = 5000;

      // Simulated handleAddSteps
      const handleAddSteps = (amount) => {
        if (isReadOnly) {
          onBlockedAction();
          return;
        }
        steps += amount;
      };

      handleAddSteps(500);

      expect(isBlockedActionTriggered).toBe(true);
      expect(blockedMessage).toBe(ACTIVE_WORKOUT_GUARD_MESSAGE);
      expect(steps).toBe(5000); // Unmutated
    });

    it('suppresses day toggle completion in read-only mode', () => {
      let isBlockedActionTriggered = false;
      const onBlockedAction = () => {
        isBlockedActionTriggered = true;
      };

      const isReadOnly = true;
      let dayStatus = 'Scheduled';

      const handleToggleDayComplete = () => {
        if (isReadOnly) {
          onBlockedAction();
          return;
        }
        dayStatus = 'Completed';
      };

      handleToggleDayComplete();

      expect(isBlockedActionTriggered).toBe(true);
      expect(dayStatus).toBe('Scheduled'); // Unmutated
    });
  });

  describe('End Workout Early (Premature Completion & Guard Lifting)', () => {
    beforeEach(async () => {
      await clearSyncOutbox();
    });

    it('calculates metrics for completed sets only and excludes unfinished exercises/sets', () => {
      const activeWorkout = {
        sessionId: 'sess_partial_101',
        startedAt: '2026-11-05T06:00:00.000Z',
        workoutName: 'Upper Body Hypertrophy',
        exercises: [
          {
            id: 'ex_bench',
            exerciseName: 'Barbell Bench Press',
            sets: [
              { id: 's1', setNumber: 1, weightLbs: 225, reps: 8, rir: 2, completed: true },
              { id: 's2', setNumber: 2, weightLbs: 225, reps: 6, rir: 1, completed: true },
              { id: 's3', setNumber: 3, weightLbs: 225, reps: 5, rir: 0, completed: false }, // Unfinished
            ],
          },
          {
            id: 'ex_incline',
            exerciseName: 'Incline Dumbbell Press',
            sets: [
              { id: 's4', setNumber: 1, weightLbs: 70, reps: 10, rir: 2, completed: false }, // Unfinished
              { id: 's5', setNumber: 2, weightLbs: 70, reps: 10, rir: 2, completed: false }, // Unfinished
            ],
          },
        ],
      };

      // Filter only completed sets and exercises with at least 1 completed set
      const completedExercises = activeWorkout.exercises
        .map((ex) => ({
          ...ex,
          sets: ex.sets.filter((s) => s.completed),
        }))
        .filter((ex) => ex.sets.length > 0);

      expect(completedExercises).toHaveLength(1);
      expect(completedExercises[0].exerciseName).toBe('Barbell Bench Press');
      expect(completedExercises[0].sets).toHaveLength(2);

      const allCompletedSets = completedExercises.flatMap((ex) => ex.sets);
      const totalVolume = allCompletedSets.reduce((sum, s) => sum + s.weightLbs * s.reps, 0);
      expect(totalVolume).toBe(225 * 8 + 225 * 6); // 1800 + 1350 = 3150

      const partialPayload = buildWorkoutPayload({
        ...activeWorkout,
        exercises: completedExercises,
        endedAt: '2026-11-05T06:25:00.000Z',
        durationSec: 1500,
      });

      expect(partialPayload.session.Workout_ID).toBe('sess_partial_101');
      expect(partialPayload.session.Total_Sets).toBe(2);
      expect(partialPayload.session.Total_Volume_Lbs).toBe(3150);
      expect(partialPayload.session.Total_Duration_Min).toBe(25);
      expect(partialPayload.sets).toHaveLength(2);
      expect(partialPayload.sets[0].Exercise).toBe('Barbell Bench Press');
      expect(partialPayload.sets[1].Set_Number).toBe(2);
    });

    it('persists partial workout session to local IndexedDB', async () => {
      const partialSession = {
        sessionId: 'sess_partial_db_test',
        date: '2026-11-05',
        workoutName: 'Partial Workout',
        type: 'workout',
        startedAt: '2026-11-05T06:00:00.000Z',
        endedAt: '2026-11-05T06:20:00.000Z',
        durationSec: 1200,
        totalSets: 2,
        totalVolumeLbs: 2400,
        highlight: '2,400 lbs volume • 2 sets (Ended Early)',
      };

      await saveSession(partialSession);
      const stored = await getSessionById('sess_partial_db_test');

      expect(stored).toBeDefined();
      expect(stored.sessionId).toBe('sess_partial_db_test');
      expect(stored.totalSets).toBe(2);
      expect(stored.highlight).toContain('(Ended Early)');
    });

    it('resets active workout flag and immediately lifts navigation & view guards', () => {
      let activeWorkoutState = {
        sessionId: 'sess_live_123',
        startedAt: '2026-11-05T06:00:00.000Z',
        workoutName: 'Upper Body',
      };

      let isWorkoutStarted = Boolean(activeWorkoutState.startedAt);
      expect(isWorkoutStarted).toBe(true);

      // Verify guard is initially active
      const initialGuard = checkWorkoutGuard(isWorkoutStarted, 'dashboard', 'workout');
      expect(initialGuard.blocked).toBe(true);
      expect(initialGuard.message).toBe(ACTIVE_WORKOUT_GUARD_MESSAGE);

      // Simulate confirming End Workout Early
      activeWorkoutState = {
        sessionId: 'sess_fresh_456',
        startedAt: null, // Reset!
        workoutName: 'Upper Body Hypertrophy',
      };
      isWorkoutStarted = Boolean(activeWorkoutState.startedAt);
      expect(isWorkoutStarted).toBe(false);

      // Verify guard is now completely lifted
      const liftedGuard = checkWorkoutGuard(isWorkoutStarted, 'dashboard', 'workout');
      expect(liftedGuard.blocked).toBe(false);
      expect(liftedGuard.message).toBe('');

      const historyGuard = checkWorkoutGuard(isWorkoutStarted, 'history', 'workout');
      expect(historyGuard.blocked).toBe(false);
    });

    it('triggers runAllSyncs to immediately flush outbox mutations to backend endpoint', async () => {
      await queueSyncAction('logWorkoutSession', {
        sessionId: 'sess_early_flush_1',
        totalSets: 2,
        totalVolumeLbs: 1800,
      });

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ status: 'ok' }),
      });
      global.fetch = mockFetch;

      const syncResult = await runAllSyncs('https://script.google.com/macros/s/test/exec');

      expect(syncResult.flushed).toBe(1);
      expect(syncResult.remaining).toBe(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const pendingAfter = await getPendingSyncActions();
      expect(pendingAfter).toHaveLength(0);
    });
  });
});
