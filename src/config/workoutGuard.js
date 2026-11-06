/**
 * Active Workout Navigation and Interaction Guard
 *
 * Prevents state conflicts and accidental data loss when a workout is in progress (`isWorkoutStarted === true`).
 * Restricts navigation away from active workout sessions and locks secondary views (Weekly Plan,
 * Logbook Archive) into a protected read-only state.
 */

export const ACTIVE_WORKOUT_GUARD_MESSAGE =
  'You currently have an active workout in progress. Please complete or finish your current workout session before accessing or modifying other training plans.';

/**
 * Validates whether a navigation transition or action is allowed during an active workout session.
 *
 * @param {boolean} isWorkoutStarted - Whether an active session timer/workout has been started
 * @param {string} targetActionOrView - The destination view key ('dashboard', 'history', 'workout') or action identifier
 * @param {string} [currentView='workout'] - Current active view
 * @returns {{ blocked: boolean, message: string }}
 */
export const checkWorkoutGuard = (isWorkoutStarted, targetActionOrView, currentView = 'workout') => {
  if (!isWorkoutStarted) {
    return { blocked: false, message: '' };
  }

  // Allowed while workout is started: staying on workout view or resuming active WOD
  if (
    targetActionOrView === 'workout' ||
    targetActionOrView === 'openTodaysWod' ||
    (currentView !== 'workout' && targetActionOrView === 'workout')
  ) {
    return { blocked: false, message: '' };
  }

  return {
    blocked: true,
    message: ACTIVE_WORKOUT_GUARD_MESSAGE,
  };
};
