import { ACTIVE_WORKOUT_GUARD_MESSAGE } from '../../config/workoutGuard';

/**
 * ActiveWorkoutGuardModal
 *
 * Intercept dialog presented whenever an action or navigation attempt is blocked
 * due to an ongoing active workout session (`isWorkoutStarted === true`).
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the intercept modal is open
 * @param {string} [props.message] - Custom intercept message (defaults to ACTIVE_WORKOUT_GUARD_MESSAGE)
 * @param {Function} props.onClose - Dismiss modal handler
 * @param {Function} props.onResumeWorkout - Handler to return to active workout screen
 * @param {Function} [props.onProceedReadOnly] - Optional handler to view secondary plan in read-only mode
 */
export const ActiveWorkoutGuardModal = ({
  isOpen,
  message = ACTIVE_WORKOUT_GUARD_MESSAGE,
  onClose,
  onResumeWorkout,
  onProceedReadOnly,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="guard-modal-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="guard-modal-title"
      aria-describedby="guard-modal-desc"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="guard-modal-card">
        <div className="guard-modal-header">
          <span className="guard-modal-icon" aria-hidden="true">
            ⚠️
          </span>
          <div className="guard-modal-title-wrap">
            <h3 id="guard-modal-title" className="guard-modal-title">
              Active Workout In Progress
            </h3>
            <span className="guard-modal-badge">Session Locked</span>
          </div>
        </div>

        <p id="guard-modal-desc" className="guard-modal-message">
          {message}
        </p>

        <div className="guard-modal-actions">
          <button
            type="button"
            className="guard-btn-primary"
            onClick={onResumeWorkout}
            autoFocus
          >
            Resume Workout →
          </button>

          {onProceedReadOnly && (
            <button
              type="button"
              className="guard-btn-secondary"
              onClick={onProceedReadOnly}
            >
              View in Read-Only Mode
            </button>
          )}

          <button
            type="button"
            className="guard-btn-dismiss"
            onClick={onClose}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActiveWorkoutGuardModal;
