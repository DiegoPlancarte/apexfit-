import { ACTIVE_WORKOUT_GUARD_MESSAGE } from '../../config/workoutGuard';

/**
 * ActiveWorkoutBanner
 *
 * Persistent warning banner displayed on secondary views (Weekly Fitness Plan, Logbook Archive)
 * when an active workout is in progress (`isWorkoutStarted === true`), reinforcing read-only
 * state enforcement and providing a quick one-tap path back to the active session.
 *
 * @param {Object} props
 * @param {string} [props.workoutName] - Current active workout name
 * @param {string} [props.formattedSessionClock] - Formatted elapsed clock MM:SS
 * @param {Function} props.onResumeWorkout - Callback to return to active workout view
 */
export const ActiveWorkoutBanner = ({
  workoutName = 'Workout Session',
  formattedSessionClock = '00:00',
  onResumeWorkout,
}) => {
  return (
    <div className="active-workout-banner" role="status" aria-live="polite">
      <div className="active-workout-banner-body">
        <div className="active-workout-banner-pill">
          <span className="banner-pulse-dot" aria-hidden="true" />
          <span className="banner-workout-name">{workoutName}</span>
          <span className="banner-clock-readout">{formattedSessionClock}</span>
        </div>

        <p className="active-workout-banner-message">
          {ACTIVE_WORKOUT_GUARD_MESSAGE}
        </p>
      </div>

      <button
        type="button"
        className="banner-resume-action-btn"
        onClick={onResumeWorkout}
        title="Return to the active workout session"
      >
        Resume Workout →
      </button>
    </div>
  );
};

export default ActiveWorkoutBanner;
