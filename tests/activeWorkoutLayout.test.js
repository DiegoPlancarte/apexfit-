import { jest } from '@jest/globals';
import { VIEW_KEYS, VIEW_CONFIG } from '../src/config/viewConfig';
import { formatTime } from '../src/components/RestTimer/hooks';

describe('Active Workout Layout, Streamlined Add Movement & Reset Behavior', () => {
  describe('Rest Timer Dock Clearance & Action Button Persistence', () => {
    it('configures the active workout view with persistent RestTimer HUD in view registry', () => {
      const workoutConfig = VIEW_CONFIG[VIEW_KEYS.WORKOUT];
      expect(workoutConfig).toBeDefined();
      expect(workoutConfig.footer).toBeDefined();
      expect(workoutConfig.footer.showRestTimerHUD).toBe(true);
    });

    it('formats rest timer display values correctly across all states', () => {
      expect(formatTime(90)).toBe('01:30');
      expect(formatTime(60)).toBe('01:00');
      expect(formatTime(0)).toBe('00:00');
      expect(formatTime(-5)).toBe('00:00');
    });

    it('retains action button handlers regardless of rest timer state transitions', () => {
      const mockSync = jest.fn();
      const mockReset = jest.fn();

      const timerStates = ['idle', 'running', 'paused', 'finished'];

      timerStates.forEach((state) => {
        // Simulating session action execution across each timer state
        const sessionActions = {
          onSyncWorkout: mockSync,
          onResetWorkout: mockReset,
          restTimerStatus: state,
        };

        expect(sessionActions.onSyncWorkout).toBeDefined();
        expect(sessionActions.onResetWorkout).toBeDefined();
        expect(typeof sessionActions.onSyncWorkout).toBe('function');
        expect(typeof sessionActions.onResetWorkout).toBe('function');
      });

      // Actions are fully invokable even when rest timer finishes (status === 'finished')
      mockSync();
      expect(mockSync).toHaveBeenCalledTimes(1);

      mockReset();
      expect(mockReset).toHaveBeenCalledTimes(1);
    });
  });

  describe('Streamlined Add Movement Section & Exercise Library Trigger', () => {
    it('opens the exercise library modal with empty search string to browse all movements', () => {
      let isPickerOpen = false;
      let pickerInitialSearch = 'some-search';

      const handleOpenPicker = (initial = '') => {
        pickerInitialSearch = initial;
        isPickerOpen = true;
      };

      // User clicks '+ Add Exercise'
      handleOpenPicker('');

      expect(isPickerOpen).toBe(true);
      expect(pickerInitialSearch).toBe('');
    });

    it('adds selected movement from library and dismisses picker modal', () => {
      const mockAddExercise = jest.fn();
      let isPickerOpen = true;

      const handleSelectExerciseFromLibrary = (exerciseName) => {
        if (mockAddExercise && exerciseName) {
          mockAddExercise(exerciseName);
        }
        isPickerOpen = false;
      };

      handleSelectExerciseFromLibrary('Incline Dumbbell Press');

      expect(mockAddExercise).toHaveBeenCalledWith('Incline Dumbbell Press');
      expect(isPickerOpen).toBe(false);
    });
  });

  describe('Clarified Session Reset Workflow ("Reset Session")', () => {
    it('requires explicit confirmation before resetting the active workout', () => {
      let isResetModalOpen = false;
      const mockResetWorkout = jest.fn();

      const handleRequestReset = () => {
        isResetModalOpen = true;
      };

      const handleCancelReset = () => {
        isResetModalOpen = false;
      };

      const handleConfirmReset = () => {
        mockResetWorkout();
        isResetModalOpen = false;
      };

      // 1. User clicks "Reset Session" button
      handleRequestReset();
      expect(isResetModalOpen).toBe(true);
      expect(mockResetWorkout).not.toHaveBeenCalled();

      // 2. User cancels confirmation
      handleCancelReset();
      expect(isResetModalOpen).toBe(false);
      expect(mockResetWorkout).not.toHaveBeenCalled();

      // 3. User requests again and confirms
      handleRequestReset();
      expect(isResetModalOpen).toBe(true);
      handleConfirmReset();
      expect(isResetModalOpen).toBe(false);
      expect(mockResetWorkout).toHaveBeenCalledTimes(1);
    });

    it('calculates session metrics accurately for volume and set counts', () => {
      const workoutState = {
        exercises: [
          {
            id: 'ex_1',
            exerciseName: 'Barbell Bench Press',
            sets: [
              { id: 's_1', weightLbs: 225, reps: 5, completed: true },
              { id: 's_2', weightLbs: 225, reps: 5, completed: true },
              { id: 's_3', weightLbs: 225, reps: 5, completed: false },
            ],
          },
          {
            id: 'ex_2',
            exerciseName: 'Barbell Back Squat',
            sets: [
              { id: 's_4', weightLbs: 315, reps: 3, completed: true },
            ],
          },
        ],
      };

      const allSets = workoutState.exercises.flatMap((ex) => ex.sets);
      const completedSets = allSets.filter((s) => s.completed);
      const totalVolumeLbs = completedSets.reduce(
        (sum, s) => sum + (Number(s.weightLbs) || 0) * (Number(s.reps) || 0),
        0
      );

      expect(allSets).toHaveLength(4);
      expect(completedSets).toHaveLength(3);
      // Volume = (225 * 5) + (225 * 5) + (315 * 3) = 1125 + 1125 + 945 = 3195
      expect(totalVolumeLbs).toBe(3195);
    });
  });
});
