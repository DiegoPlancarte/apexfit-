import { useComponentLogic } from './hooks';

/**
 * RestTimer Component
 * Streamlined mobile HUD that starts automatically upon completing a set using the
 * exercise-level rest duration. Displays countdown and elapsed rest, with Pause/Resume
 * and Stop buttons.
 */
export default function RestTimer(props) {
  const { targetSetInfo = null } = props;
  const {
    elapsedRestSec,
    status,
    progressPct,
    activeExerciseName,
    formattedRemaining,
    formattedDuration,
    handleStartOrResume,
    handlePause,
    handleStop,
  } = useComponentLogic(props);

  return (
    <section className={`rest-timer-bar rest-timer-${status}`} aria-label="Rest Timer">
      <div className="rest-timer-progress-track">
        <div
          className="rest-timer-progress-fill"
          style={{ width: `${status === 'idle' ? 0 : progressPct}%` }}
        />
      </div>

      <div className="rest-timer-header">
        <div className="rest-timer-info">
          <span className="rest-timer-badge">
            {status === 'running' && 'RESTING'}
            {status === 'paused' && 'PAUSED'}
            {status === 'finished' && 'REST COMPLETE'}
            {status === 'idle' && 'REST TIMER'}
          </span>
          {targetSetInfo?.exerciseName && status !== 'idle' ? (
            <span className="rest-timer-context">
              {targetSetInfo.exerciseName} • Set #{targetSetInfo.setNumber} ({formattedDuration})
            </span>
          ) : (
            <span className="rest-timer-context">
              {activeExerciseName} • Target: {formattedDuration}
            </span>
          )}
        </div>

        <div className="rest-timer-readout">
          <span className="rest-timer-countdown">{formattedRemaining}</span>
          <span className="rest-timer-elapsed" title="Actual rest elapsed">
            Elapsed: {elapsedRestSec}s
          </span>
        </div>
      </div>

      <div className="rest-timer-controls">
        {status === 'running' && (
          <button
            type="button"
            className="timer-btn timer-btn-warning"
            onClick={handlePause}
          >
            Pause
          </button>
        )}
        {status === 'paused' && (
          <button
            type="button"
            className="timer-btn timer-btn-primary"
            onClick={handleStartOrResume}
          >
            Resume
          </button>
        )}

        <button
          type="button"
          className="timer-btn timer-btn-stop"
          onClick={handleStop}
          disabled={status === 'idle'}
          aria-label="Stop rest timer"
        >
          Stop Rest
        </button>
      </div>
    </section>
  );
}
